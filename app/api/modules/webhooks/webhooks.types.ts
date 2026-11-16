/**
 * @module webhooks.types
 *
 * TypeScript interfaces for the webhooks feature module.
 */

export interface TelebirrWebhookBody {
  externalTransactionId: string
  merchantCode: string
  transactionId: string
  amount: string
  currency: string
  status: string
  paymentTime: string
  subscriberNumber: string
  [key: string]: unknown
}

export interface SmsDeliveryWebhookBody {
  messageId: string
  status: 'DELIVERED' | 'FAILED' | 'EXPIRED' | 'UNKNOWN'
  deliveredAt?: string
  errorCode?: string
  errorMessage?: string
  [key: string]: unknown
}

export interface WebhookProcessedResult {
  received: boolean
  eventId: string
}
