/**
 * S-7.12 Offline surface (spec 09 § S-7.12).
 * "Persistent, with a queued-write count."
 */

export interface OfflineConfig {
  readonly queuedWriteCount: number
  readonly lastUpdated: string | null
}

export function offlineBannerMessage(config: OfflineConfig): string {
  const queuePart =
    config.queuedWriteCount > 0
      ? ` — ${config.queuedWriteCount} ${config.queuedWriteCount === 1 ? 'change' : 'changes'} waiting to sync`
      : ''
  return `You're offline. Settings are read-only until you reconnect.${queuePart}`
}

export function offlineStaleLabel(config: OfflineConfig): string | null {
  if (!config.lastUpdated) return null
  return `Last updated ${config.lastUpdated}`
}

export function shouldDisableWriteActions(isOffline: boolean): {
  disabled: boolean
  reason: string | null
} {
  if (isOffline) {
    return { disabled: true, reason: "You're offline — this needs a connection" }
  }
  return { disabled: false, reason: null }
}
