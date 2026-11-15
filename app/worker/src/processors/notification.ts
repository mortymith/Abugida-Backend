/**
 * @module processors/notification
 * @description Processors for SMS and email notification jobs. SMS messages
 * are delivered through the SMSEthiopia API (see `integrations/smsethiopia`).
 */

import * as BullMQ from 'bullmq'
import type { SmsNotificationJobData, EmailNotificationJobData } from '@abugida/queue'
import type { JobProcessor } from '@/runtime/types'
import { getSMSEthiopiaClient, normalizeMsisdn } from '@/integrations'
import { toJobError } from '@/integrations/job-error'
import { logger } from '@/config/observability'

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
  const log = logger.child({ processor: 'notification:sms', jobId: job.id })

  const msisdn = normalizeMsisdn(recipientPhone)
  if (!msisdn) {
    // Invalid input will never succeed on retry – fail permanently.
    throw new BullMQ.UnrecoverableError(
      `SMS_NOTIFICATION rejected an invalid recipient phone: ${maskPhone(recipientPhone)}`,
    )
  }

  log.info(
    {
      recipient: maskPhone(recipientPhone),
      idempotencyKey,
      templateId,
      length: message.length,
    },
    'Sending SMS',
  )

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

    log.debug({ messageId: result.id }, 'SMS accepted by SMSEthiopia')

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
 *
 * Status: **gated**. No email delivery service is wired up yet, so the
 * processor throws `UnrecoverableError` instead of returning a success
 * result. BullMQ keeps the job in the failed set instead of completing and
 * removing it, so queued work is never silently discarded (ADR-028, Risks).
 */
export const processEmailNotification: JobProcessor<EmailNotificationJobData> = async () => {
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

  throw new BullMQ.UnrecoverableError(
    'EMAIL_NOTIFICATION is not implemented yet: no email delivery service is wired up (ADR-028).',
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****'
  return phone.slice(0, 3) + '****' + phone.slice(-2)
}
