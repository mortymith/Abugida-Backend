/**
 * @test runtime/processors
 * @description Unit tests for the worker's queue selection.
 */

import { describe, expect, test } from 'bun:test'

import { ALL_QUEUES, parseQueueSelection, selectProcessors } from '@/runtime/queues'

describe('parseQueueSelection', () => {
  test('"all" selects every declared queue', () => {
    const queues = parseQueueSelection(ALL_QUEUES)
    expect(queues.length).toBeGreaterThan(0)
    expect(queues).toContain('abugida.purchases')
    expect(queues).toContain('abugida.webhooks')
  })

  test('"ALL" is case-insensitive', () => {
    expect(parseQueueSelection('ALL')).toEqual(parseQueueSelection(ALL_QUEUES))
  })

  test('a CSV selects exactly the named queues', () => {
    expect(parseQueueSelection('abugida.purchases,abugida.webhooks')).toEqual([
      'abugida.purchases',
      'abugida.webhooks',
    ])
  })

  test('whitespace around queue names is ignored', () => {
    expect(parseQueueSelection(' abugida.purchases , abugida.webhooks ')).toEqual([
      'abugida.purchases',
      'abugida.webhooks',
    ])
  })

  test('duplicates are collapsed', () => {
    expect(parseQueueSelection('abugida.purchases,abugida.purchases')).toEqual([
      'abugida.purchases',
    ])
  })

  test('an unknown queue name is rejected', () => {
    expect(() => parseQueueSelection('abugida.nope')).toThrow(/unknown queue/i)
  })

  test('an empty selection is rejected', () => {
    expect(() => parseQueueSelection('   ')).toThrow(/must not be empty/i)
  })
})

describe('selectProcessors', () => {
  test('every queue has at least one processor', () => {
    const { queues, processors } = selectProcessors(ALL_QUEUES)
    expect(processors.length).toBeGreaterThanOrEqual(queues.length)
  })

  test('the selected processors only belong to the selected queues', () => {
    const { queues, processors } = selectProcessors('abugida.purchases')
    expect(queues).toEqual(['abugida.purchases'])
    expect(processors.length).toBeGreaterThan(0)
    for (const processor of processors) {
      expect(processor.queueName).toBe('abugida.purchases')
    }
  })
})
