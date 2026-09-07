/**
 * @test helpers/stub-fetch
 * @description Shared global-fetch stub for unit tests. The stub answers
 * every request from a synchronous handler and records nothing; tests that
 * need call assertions can capture state inside their handler. Always call
 * {@link restoreFetch} in `afterAll` so other suites hit the real network
 * (or fail loudly) instead of a stale stub.
 */

type StubResponse = { status?: number; json: unknown }

type StubHandler = (url: string, body: unknown) => StubResponse

const originalFetch = globalThis.fetch

/** Replace the global `fetch` with a JSON stub driven by `handler`. */
function stubFetch(handler: StubHandler): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let body: unknown
    if (typeof init?.body === 'string' && init.body.length > 0) {
      try {
        body = JSON.parse(init.body) as unknown
      } catch {
        body = init.body
      }
    }
    const response = handler(url, body)
    return new Response(JSON.stringify(response.json), {
      status: response.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

/** Restore the original global `fetch`. */
function restoreFetch(): void {
  globalThis.fetch = originalFetch
}

/** Format a date as a Telebirr `yyyyMMddHHmmss` UTC timestamp. */
function telebirrTimestamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}` +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  )
}

export { restoreFetch, stubFetch, telebirrTimestamp }
export type { StubHandler, StubResponse }
