import { describe, expect, test } from 'bun:test'
import {
  offlineBannerMessage,
  offlineStaleLabel,
  shouldDisableWriteActions,
} from '#/components/common/common.offline-surface'
import type { OfflineConfig } from '#/components/common/common.offline-surface'

describe('offlineBannerMessage', () => {
  test('includes read-only message', () => {
    const config: OfflineConfig = { queuedWriteCount: 0, lastUpdated: null }
    expect(offlineBannerMessage(config)).toContain('read-only')
  })
  test('includes queued count when > 0', () => {
    const config: OfflineConfig = { queuedWriteCount: 3, lastUpdated: null }
    expect(offlineBannerMessage(config)).toContain('3 changes waiting to sync')
  })
  test('singular for 1 queued change', () => {
    const config: OfflineConfig = { queuedWriteCount: 1, lastUpdated: null }
    expect(offlineBannerMessage(config)).toContain('1 change waiting')
  })
})
describe('offlineStaleLabel', () => {
  test('null when no lastUpdated', () => {
    expect(offlineStaleLabel({ queuedWriteCount: 0, lastUpdated: null })).toBeNull()
  })
  test('includes timestamp', () => {
    expect(offlineStaleLabel({ queuedWriteCount: 0, lastUpdated: '4:12 PM EAT' })).toContain(
      '4:12 PM EAT',
    )
  })
})
describe('shouldDisableWriteActions', () => {
  test('disabled when offline', () => {
    const r = shouldDisableWriteActions(true)
    expect(r.disabled).toBe(true)
    expect(r.reason).toContain('offline')
  })
  test('enabled when online', () => {
    expect(shouldDisableWriteActions(false).disabled).toBe(false)
  })
})
