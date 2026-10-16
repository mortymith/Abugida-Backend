import { describe, expect, test } from 'bun:test'
import {
  keyboardDragAnnouncement,
  keyboardDragReducer,
  prefersReducedMotion,
} from '#/components/common/common.accessibility'

describe('keyboardDragReducer', () => {
  test('pick_up from idle', () => {
    const state = keyboardDragReducer(
      { kind: 'idle' },
      { type: 'pick_up', itemId: 'i1', position: 2 },
      5,
    )
    expect(state.kind).toBe('picked_up')
  })
  test('move up', () => {
    const state = keyboardDragReducer(
      { kind: 'picked_up', itemId: 'i1', sourcePosition: 2 },
      { type: 'move', direction: 'up' },
      5,
    )
    expect(state.kind).toBe('moving')
    if (state.kind === 'moving') expect(state.currentPosition).toBe(1)
  })
  test('move down', () => {
    const state = keyboardDragReducer(
      { kind: 'moving', itemId: 'i1', currentPosition: 1 },
      { type: 'move', direction: 'down' },
      5,
    )
    if (state.kind === 'moving') expect(state.currentPosition).toBe(2)
  })
  test('move clamped at 0', () => {
    const state = keyboardDragReducer(
      { kind: 'moving', itemId: 'i1', currentPosition: 0 },
      { type: 'move', direction: 'up' },
      5,
    )
    if (state.kind === 'moving') expect(state.currentPosition).toBe(0)
  })
  test('move clamped at max', () => {
    const state = keyboardDragReducer(
      { kind: 'moving', itemId: 'i1', currentPosition: 4 },
      { type: 'move', direction: 'down' },
      5,
    )
    if (state.kind === 'moving') expect(state.currentPosition).toBe(4)
  })
  test('drop', () => {
    const state = keyboardDragReducer(
      { kind: 'moving', itemId: 'i1', currentPosition: 3 },
      { type: 'drop' },
      5,
    )
    expect(state.kind).toBe('dropped')
    if (state.kind === 'dropped') expect(state.finalPosition).toBe(3)
  })
  test('cancel returns to idle', () => {
    const state = keyboardDragReducer(
      { kind: 'moving', itemId: 'i1', currentPosition: 3 },
      { type: 'cancel' },
      5,
    )
    expect(state.kind).toBe('idle')
  })
})
describe('keyboardDragAnnouncement', () => {
  test('picked_up announces instructions', () => {
    const msg = keyboardDragAnnouncement(
      { kind: 'picked_up', itemId: 'i1', sourcePosition: 2 },
      'Essay draft',
      5,
    )
    expect(msg).toContain('Picked up')
    expect(msg).toContain('Essay draft')
  })
  test('moving announces position', () => {
    const msg = keyboardDragAnnouncement(
      { kind: 'moving', itemId: 'i1', currentPosition: 2 },
      'Essay draft',
      5,
    )
    expect(msg).toContain('position 3 of 5')
  })
  test('dropped announces final position', () => {
    const msg = keyboardDragAnnouncement(
      { kind: 'dropped', itemId: 'i1', finalPosition: 3 },
      'Essay draft',
      5,
    )
    expect(msg).toContain('dropped at position 4')
  })
  test('idle → empty', () => {
    expect(keyboardDragAnnouncement({ kind: 'idle' }, 'x', 5)).toBe('')
  })
})
describe('prefersReducedMotion', () => {
  test('returns boolean', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean')
  })
})
