/**
 * @module processors/notification
 * @description Processors for SMS and email notification jobs. SMS messages
 * are delivered through the SMSEthiopia API (see `integrations/smsethiopia`).
 */

import { UnrecoverableError } from 'bullmq'
import type {
  AnyProcessorEntry,
  JobProcessor,
  SmsNotificationJobData,
  EmailNotificationJobData,
} from '../core/types.js'
import { JobType } from '../core/types.js'
import { QUEUE_NAMES } from '../definitions/queues.js'
import { getSMSEthiopiaClient, normalizeMsisdn } from '../integrations/index.js'
import { toJobError } from '../integrations/job-error.js'
import { getLogger } from '../utils/logger.js'

// ---------------------------------------------------------------------------
// SMS Notification Processor
// ---------------------------------------------------------------------------

/**
 * Send SMS notifications via the SMSEthiopia API.
 *
 * The recipient is normalized to international digits (Ethiopian local
 * formats accepted) before sending; permanently invalid recipients and
 * provider rejections abort the job without consuming further retries.
 * Transient failures (network, 5xx) remain retryable and are handled by
 * the queue's exponential backoff.
 *
 * Expected side effects:
 * - Validate and normalize the recipient phone number
 * - Call the SMSEthiopia API to send the message
 * - Record the notification in the database (pending DB integration)
 */
export const processSmsNotification: JobProcessor<SmsNotificationJobData> = async (data, job) => {
  const { recipientPhone, message, templateId, idempotencyKey } = data
  const logger = getLogger().child({ processor: 'notification:sms', jobId: job.id })

  const msisdn = normalizeMsisdn(recipientPhone)
  if (!msisdn) {
    // Invalid input will never succeed on retry – fail permanently.
    throw new UnrecoverableError(
      `SMS_NOTIFICATION rejected an invalid recipient phone: ${maskPhone(recipientPhone)}`,
    )
  }

  logger.info(`Sending SMS to ${maskPhone(recipientPhone)}`, {
    idempotencyKey,
    templateId,
    length: message.length,
  })

  try {
    const sms = getSMSEthiopiaClient()
    // NOTE: templateId rendering requires the notifications DB schema; the
    // message body is sent as provided until template storage is wired up.
    const result = await sms.send({ msisdn, text: message })

    // TODO: record the notification in the database:
    // await db.insert(notifications).values({
    //   type: 'sms',
    //   recipient: recipientPhone,
    //   status: 'sent',
    //   externalId: result.id,
    //   idempotencyKey,
    // });

    logger.debug('SMS accepted by SMSEthiopia', { messageId: result.id })

    return {
      recipientPhone: maskPhone(recipientPhone),
      status: 'sent',
      messageId: result.id,
      ...(result.segments === null ? {} : { segments: result.segments }),
      processedAt: new Date().toISOString(),
    }
  } catch (error) {
    throw toJobError(error)
  }
}

// ---------------------------------------------------------------------------
// Email Notification Processor
// ---------------------------------------------------------------------------

/**
 * Send email notifications.
 *
 * Expected side effects:
 * - Validate recipient email address
 * - Render HTML template if templateId provided
 * - Send via email service (e.g., Resend, SendGrid)
 * - Record the notification in the database
 */
export const processEmailNotification: JobProcessor<EmailNotificationJobData> = async (
  data,
  job,
) => {
  const { recipientEmail, subject, templateId, idempotencyKey } = data

  getLogger()
    .child({ processor: 'notification:email' })
    .debug(`Sending email to ${maskEmail(recipientEmail)} subject="${subject}"`, {
      jobId: job.id,
      idempotencyKey,
      templateId,
    })

  // TODO: Replace with actual email service integration:
  // const emailClient = getEmailClient();
  // const result = await emailClient.send({
  //   to: recipientEmail,
  //   subject,
  //   html: templateId ? renderTemplate(templateId, htmlBody) : htmlBody,
  // });
  //
  // Record notification
  // await db.insert(notifications).values({
  //   type: 'email',
  //   recipient: recipientEmail,
  //   subject,
  //   status: result.success ? 'sent' : 'failed',
  //   externalId: result.messageId,
  //   idempotencyKey,
  // });

  return {
    recipientEmail: maskEmail(recipientEmail),
    subject,
    status: 'sent',
    messageId: `email_${job.id}`,
    processedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****'
  return phone.slice(0, 3) + '****' + phone.slice(-2)
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '****'
  const masked = local.slice(0, 2) + '****'
  return `${masked}@${domain}`
}

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const notificationProcessors: AnyProcessorEntry[] = [
  {
    jobType: JobType.SMS_NOTIFICATION,
    processor: processSmsNotification,
    queueName: QUEUE_NAMES.NOTIFICATIONS,
    concurrency: 10,
  },
  {
    jobType: JobType.EMAIL_NOTIFICATION,
    processor: processEmailNotification,
    queueName: QUEUE_NAMES.NOTIFICATIONS,
    concurrency: 10,
  },
]
