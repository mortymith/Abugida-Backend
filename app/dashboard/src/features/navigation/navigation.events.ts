/**
 * S-A.1 instrumentation seam.
 *
 * The spec names the navigation events (`nav.item_activated`,
 * `nav.workspace_switched`, …). There is no analytics vendor wired into the
 * dashboard, so rather than fire-and-forget, this module owns the small amount
 * of machinery an events pipeline actually needs and exposes it as one testable
 * unit:
 *
 * - **A sink.** `VITE_ANALYTICS_ENDPOINT` names the collector. When it is set,
 *   events are buffered and flushed with `navigator.sendBeacon` (or `fetch`
 *   with `keepalive`, so a flush during page unload still lands). When it is not
 *   set, nothing is buffered and nothing is sent — no dead payload, no fake
 *   success.
 * - **A flush policy.** Batched by size and by age, flushed on `pagehide` and
 *   when the tab is hidden, so the last interaction before a close is not lost.
 * - **A local contract.** Every event is dispatched as a DOM `CustomEvent`
 *   (`abugida:nav-event`) and pushed to `window.dataLayer` when one exists, so
 *   a provider added later does not need to touch a single call site.
 *
 * Nothing here throws into the UI: telemetry must never break navigation.
 */

export type NavEventName =
  | 'nav.item_activated'
  | 'nav.search_opened'
  | 'nav.palette_opened'
  | 'nav.workspace_switched'
  | 'nav.resume_clicked'
  | 'nav.sidebar_toggled'
  | 'nav.offline_banner_shown'
  | 'nav.session_expiry_warning_shown'
  | 'nav.queue_depth_changed'

export type NavEventProps = Record<string, string | number | boolean>

export interface NavEventPayload extends NavEventProps {
  event: NavEventName
  /** Epoch ms, stamped by the sink so callers never have to. */
  at: number
}

export const NAV_EVENT = 'abugida:nav-event'

/** Events per flush. Small enough that `sendBeacon` stays under browser limits. */
export const NAV_EVENT_BATCH_SIZE = 20
/** Oldest unflushed event is sent after this long. */
export const NAV_EVENT_MAX_AGE_MS = 15_000

/** What a transport has to provide — `sendBeacon` and `fetch(keepalive)`. */
export interface NavEventTransport {
  sendBeacon?: (url: string, body: string) => boolean
  fetch?: (url: string, init: { method: string; body: string; keepalive: boolean }) => void
}

/**
 * A buffered event sink. Pure with respect to the DOM: everything it touches
 * arrives as an argument, so the batching rules are testable without a browser.
 */
export function createNavEventSink({
  endpoint,
  transport,
  now = () => Date.now(),
  onFlushError,
}: {
  endpoint: string | null
  transport: NavEventTransport
  now?: () => number
  onFlushError?: (error: unknown) => void
}) {
  let buffer: NavEventPayload[] = []

  function deliver(payloads: NavEventPayload[]) {
    if (!endpoint || payloads.length === 0) return
    const body = JSON.stringify({ events: payloads })
    try {
      if (transport.sendBeacon?.(endpoint, body)) return
      transport.fetch?.(endpoint, { method: 'POST', body, keepalive: true })
    } catch (error) {
      // Telemetry is best-effort: a failed flush must never reach the UI.
      onFlushError?.(error)
    }
  }

  return {
    /** Buffer an event, flushing when the batch is full. */
    push(name: NavEventName, props: NavEventProps = {}) {
      const payload: NavEventPayload = { ...props, event: name, at: now() }
      buffer.push(payload)
      if (buffer.length >= NAV_EVENT_BATCH_SIZE) this.flush()
    },
    /** Send everything buffered so far. */
    flush() {
      if (buffer.length === 0) return
      const payloads = buffer
      buffer = []
      deliver(payloads)
    },
    /** Events waiting to be sent — exposed for diagnostics and tests. */
    pending() {
      return buffer.length
    },
  }
}

export type NavEventSink = ReturnType<typeof createNavEventSink>

interface DataLayerWindow {
  dataLayer?: Array<Record<string, unknown>>
}

let sink: NavEventSink | null = null
let sinkStarted = false

function browserEndpoint(): string | null {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT
  return typeof endpoint === 'string' && endpoint.length > 0 ? endpoint : null
}

function getSink(): NavEventSink {
  if (sink) return sink
  sink = createNavEventSink({
    endpoint: browserEndpoint(),
    transport: {
      ...(typeof navigator !== 'undefined' && 'sendBeacon' in navigator
        ? { sendBeacon: navigator.sendBeacon.bind(navigator) }
        : {}),
      ...(typeof fetch === 'function' ? { fetch } : {}),
    },
  })
  return sink
}

/**
 * Start flushing on the events that precede a teardown. Guarded so repeated
 * calls (StrictMode double-effects, route re-renders) attach one set of
 * listeners.
 */
function ensureLifecycleFlush(): void {
  if (sinkStarted || typeof window === 'undefined') return
  sinkStarted = true

  const flush = () => getSink().flush()
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })

  setInterval(() => {
    const active = getSink()
    if (active.pending() > 0) active.flush()
  }, NAV_EVENT_MAX_AGE_MS)
}

/**
 * Record a navigation event. Always broadcasts locally; sends only when a
 * collector endpoint is configured.
 */
export function trackNavEvent(name: NavEventName, props: NavEventProps = {}): void {
  if (typeof window === 'undefined') return
  ensureLifecycleFlush()

  const active = getSink()
  const payload: NavEventPayload = { ...props, event: name, at: Date.now() }

  const layer = (window as unknown as DataLayerWindow).dataLayer
  if (Array.isArray(layer)) layer.push(payload)

  window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: payload }))
  active.push(name, props)
}
