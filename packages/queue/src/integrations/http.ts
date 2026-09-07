/**
 * @module integrations/http
 * @description Minimal JSON-over-HTTP transport shared by the external
 * service integrations (Telebirr, SMSEthiopia). Built on the global `fetch`
 * (Bun / Node >= 18) with abort-based timeouts so no extra dependency is
 * required. Callers classify failures via {@link isRetryableHttpError}.
 */

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_ERROR_BODY_LENGTH = 500

/** Network-level failure: DNS, connection reset, TLS or timeout. Always retryable. */
export class HttpNetworkError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message)
    this.name = 'HttpNetworkError'
  }
}

/** Non-2xx response or a 2xx response with an unparsable body. */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export interface FetchJsonOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  /** JSON body – serialized automatically. */
  body?: unknown
  /** Request timeout in ms. Default: `30000`. */
  timeoutMs?: number
}

/**
 * Perform a JSON request and parse the response body.
 *
 * @throws {HttpNetworkError} On transport failures (retryable).
 * @throws {HttpError} On non-2xx responses or invalid JSON bodies.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new HttpNetworkError(`Request to ${sanitizeUrl(url)} failed: ${describe(error)}`, error)
  }

  const raw = await response.text()

  if (!response.ok) {
    throw new HttpError(
      `HTTP ${response.status} from ${sanitizeUrl(url)}`,
      response.status,
      truncate(raw),
    )
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(
      `Invalid JSON response from ${sanitizeUrl(url)}`,
      response.status,
      truncate(raw),
    )
  }
}

/**
 * Whether a transport error may plausibly succeed on retry.
 * Network errors and 5xx responses are transient; 4xx responses are not.
 */
export function isRetryableHttpError(error: unknown): boolean {
  if (error instanceof HttpNetworkError) return true
  if (error instanceof HttpError) return error.status >= 500
  return false
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function truncate(text: string): string {
  return text.length <= MAX_ERROR_BODY_LENGTH ? text : text.slice(0, MAX_ERROR_BODY_LENGTH) + '…'
}

/** Strip query strings so signed parameters never appear in error messages. */
function sanitizeUrl(url: string): string {
  const queryIndex = url.indexOf('?')
  return queryIndex === -1 ? url : url.slice(0, queryIndex)
}
