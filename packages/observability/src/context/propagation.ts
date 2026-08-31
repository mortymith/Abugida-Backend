/**
 * Context propagation setup.
 *
 * Configures:
 * 1. `AsyncLocalStorageContextManager` as the global context manager
 *    (required for `context.with()` to work in Bun/Node)
 * 2. W3C TraceContext + Baggage propagators as the global propagators
 */

import { propagation, context, type Context } from '@opentelemetry/api'
import {
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
  CompositePropagator,
} from '@opentelemetry/core'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'

let initialised = false

/**
 * Install the global context manager and propagators.
 *
 * Idempotent — subsequent calls are no-ops.
 */
export function initPropagation(): void {
  if (initialised) return

  // 1. Set the AsyncLocalStorage-based context manager.
  //    Without this, `context.with()` is a no-op (NoopContextManager)
  //    and spans are never visible as active.
  context.setGlobalContextManager(new AsyncLocalStorageContextManager())

  // 2. Set W3C trace-context + baggage propagators for
  //    traceparent/tracestate header extraction/injection.
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  )

  initialised = true
}

/**
 * Reset propagation state.
 * Intended for test teardown only.
 */
export function resetPropagation(): void {
  initialised = false
}

/**
 * Extract trace context from a carrier (typically request headers).
 *
 * @param carrier - key/value map of headers
 * @returns the OpenTelemetry Context with extracted trace context
 */
export function extractContext(carrier: Record<string, string>): Context {
  return propagation.extract(context.active(), carrier)
}

/**
 * Inject the current trace context into a carrier (e.g. outgoing headers).
 */
export function injectContext(carrier: Record<string, string>, ctx?: Context): void {
  propagation.inject(ctx ?? context.active(), carrier)
}
