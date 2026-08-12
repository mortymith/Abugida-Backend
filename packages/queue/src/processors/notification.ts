/**
 * @module processors/notification
 * @description Processors for SMS and email notification jobs.
 */

import type {
  AnyProcessorEntry,
  JobProcessor,
  SmsNotificationJobData,
  EmailNotificationJobData,
} from "../core/types.js";
import { JobType } from "../core/types.js";
import { QUEUE_NAMES } from "../definitions/queues.js";

// ---------------------------------------------------------------------------
// SMS Notification Processor
// ---------------------------------------------------------------------------

/**
 * Send SMS notifications via SMSEthiopia API.
 *
 * Expected side effects:
 * - Validate recipient phone number format
 * - Call SMSEthiopia API to send the message
 * - Record the notification in the database
 * - Handle delivery status callbacks
 */
export const processSmsNotification: JobProcessor<SmsNotificationJobData> = async (data, job) => {
  const { recipientPhone, templateId, idempotencyKey } = data;

  console.debug(`[notification:sms] Sending SMS to ${maskPhone(recipientPhone)}`, {
    jobId: job.id,
    idempotencyKey,
    templateId,
  });

  // TODO: Replace with actual SMSEthiopia API integration:
  // const smsClient = getSMSEthiopiaClient();
  // const result = await smsClient.send({
  //   to: recipientPhone,
  //   message: templateId ? applyTemplate(templateId, message) : message,
  // });
  //
  // Record notification
  // await db.insert(notifications).values({
  //   type: 'sms',
  //   recipient: recipientPhone,
  //   status: result.success ? 'sent' : 'failed',
  //   externalId: result.messageId,
  //   idempotencyKey,
  // });

  return {
    recipientPhone: maskPhone(recipientPhone),
    status: "sent",
    messageId: `sms_${job.id}`,
    processedAt: new Date().toISOString(),
  };
};

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
export const processEmailNotification: JobProcessor<EmailNotificationJobData> = async (data, job) => {
  const { recipientEmail, subject, templateId, idempotencyKey } = data;

  console.debug(`[notification:email] Sending email to ${maskEmail(recipientEmail)} subject="${subject}"`, {
    jobId: job.id,
    idempotencyKey,
    templateId,
  });

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
    status: "sent",
    messageId: `email_${job.id}`,
    processedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "****" + phone.slice(-2);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "****";
  const masked = local.slice(0, 2) + "****";
  return `${masked}@${domain}`;
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
];
