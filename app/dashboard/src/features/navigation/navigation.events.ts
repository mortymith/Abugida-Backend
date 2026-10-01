/**
 * S-A.1 instrumentation seam.
 *
 * The spec names the navigation events (`nav.item_activated`,
 * `nav.workspace_switched`, …) but the product has no analytics client yet, so
 * this is deliberately the smallest thing that can be true: a typed emitter that
 * hands each event to whatever consumer exists (a `dataLayer` when one is
 * present, plus a DOM `CustomEvent` any provider can subscribe to). Nothing is
 * buffered or faked, so when the real sink lands it replaces the body of this
 * module and every call site is already correct.
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

interface DataLayerWindow {
  dataLayer?: Array<Record<string, unknown>>
}

export const NAV_EVENT = 'abugida:nav-event'

export function trackNavEvent(name: NavEventName, props: NavEventProps = {}): void {
  if (typeof window === 'undefined') return
  const payload = { event: name, ...props }

  const layer = (window as unknown as DataLayerWindow).dataLayer
  if (Array.isArray(layer)) layer.push(payload)

  window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: payload }))
}
