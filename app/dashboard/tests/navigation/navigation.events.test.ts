import { describe, expect, test } from 'bun:test'
import { NAV_EVENT_BATCH_SIZE, createNavEventSink } from '#/features/navigation/navigation.events'
import type { NavEventTransport } from '#/features/navigation/navigation.events'

/** S-A.1 Instrumentation: the sink's batching and delivery rules. */

function collector() {
  const sent: Array<{ body: string; beacon: boolean }> = []
  const transport: NavEventTransport = {
    sendBeacon: (_url, body) => {
      sent.push({ body, beacon: true })
      return true
    },
    fetch: (url, init) => {
      sent.push({ body: init.body, beacon: false })
      void url
    },
  }
  return { sent, transport }
}

describe('nav event sink', () => {
  test('sends nothing when no collector endpoint is configured', () => {
    const { sent, transport } = collector()
    const sink = createNavEventSink({ endpoint: null, transport })
    sink.push('nav.item_activated', { item: 'courses' })
    sink.flush()
    expect(sent).toEqual([])
  })

  test('buffers until flushed, then sends one batch with timestamps', () => {
    const { sent, transport } = collector()
    const sink = createNavEventSink({ endpoint: '/events', transport, now: () => 1_700 })
    sink.push('nav.item_activated', { item: 'courses' })
    sink.push('nav.sidebar_toggled', { state: 'collapsed' })
    expect(sent).toEqual([])

    sink.flush()
    expect(sent).toHaveLength(1)
    const payload = JSON.parse(sent[0].body) as {
      events: Array<{ event: string; item?: string; state?: string; at: number }>
    }
    expect(payload.events.map((event) => event.event)).toEqual([
      'nav.item_activated',
      'nav.sidebar_toggled',
    ])
    expect(payload.events[0]?.item).toBe('courses')
    expect(payload.events.every((event) => event.at === 1_700)).toBe(true)
  })

  test('flushes automatically once the batch is full', () => {
    const { sent, transport } = collector()
    const sink = createNavEventSink({ endpoint: '/events', transport })
    for (let index = 0; index < NAV_EVENT_BATCH_SIZE; index += 1) {
      sink.push('nav.item_activated', { item: `item-${index}` })
    }
    expect(sent).toHaveLength(1)
    expect(sink.pending()).toBe(0)
  })

  test('falls back to fetch(keepalive) when sendBeacon is unavailable', () => {
    const { sent, transport } = collector()
    const withoutBeacon: NavEventTransport = { fetch: transport.fetch }
    const sink = createNavEventSink({ endpoint: '/events', transport: withoutBeacon })
    sink.push('nav.palette_opened', { trigger: 'keyboard' })
    sink.flush()
    expect(sent[0]?.beacon).toBe(false)
  })

  test('a failing transport never throws into the UI', () => {
    const errors: unknown[] = []
    const sink = createNavEventSink({
      endpoint: '/events',
      transport: {
        sendBeacon: () => {
          throw new Error('beacon blocked')
        },
      },
      onFlushError: (error) => errors.push(error),
    })
    sink.push('nav.item_activated', { item: 'dashboard' })
    expect(() => sink.flush()).not.toThrow()
    expect(errors).toHaveLength(1)
  })

  test('flushing an empty buffer is a no-op', () => {
    const { sent, transport } = collector()
    const sink = createNavEventSink({ endpoint: '/events', transport })
    sink.flush()
    expect(sent).toEqual([])
  })
})
