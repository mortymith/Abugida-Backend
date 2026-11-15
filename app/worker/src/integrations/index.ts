/**
 * @module integrations/index
 * @description Barrel for external service integrations (Telebirr payment
 * gateway, SMSEthiopia SMS API) and their shared HTTP/error plumbing.
 */

export { IntegrationError, describeError } from './errors.js'
export {
  fetchJson,
  isRetryableHttpError,
  HttpError,
  HttpNetworkError,
  type FetchJsonOptions,
} from './http.js'
export { toJobError } from './job-error.js'
export * from './telebirr.js'
export * from './smsethiopia.js'
