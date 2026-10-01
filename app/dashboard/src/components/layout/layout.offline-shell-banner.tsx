import { useEffect, useRef } from 'react'
import { useOnline } from '#/hooks/use-online'
import { OfflineBanner } from '#/components/common/offline-banner'
import { trackNavEvent } from '#/features/navigation'

/**
 * Shell-owned **Offline** state (spec 11 § Resilience States).
 *
 * A persistent banner, never a toast: it must still be on screen ten minutes
 * later. The copy names the consequence and, when there is queued work to talk
 * about, the depth inline — _"3 changes waiting to sync."_ — because that number
 * is the user's only evidence that nothing was lost.
 *
 * Reads come from cache and navigation keeps working; the queue itself belongs to
 * the autosave contract of each editing surface, so this component reports the
 * depth it is given rather than owning a queue.
 */
export function ShellOfflineBanner({ queueDepth = 0 }: { queueDepth?: number }) {
  const online = useOnline()
  const wasOffline = useRef(false)
  const shownAt = useRef<number | null>(null)

  useEffect(() => {
    if (!online) {
      if (!wasOffline.current) {
        shownAt.current = Date.now()
        trackNavEvent('nav.offline_banner_shown', { duration: 0 })
      }
      wasOffline.current = true
      return
    }
    if (wasOffline.current) {
      const duration = shownAt.current ? Math.round((Date.now() - shownAt.current) / 1000) : 0
      trackNavEvent('nav.offline_banner_shown', { duration })
      wasOffline.current = false
      shownAt.current = null
    }
  }, [online])

  useEffect(() => {
    trackNavEvent('nav.queue_depth_changed', { depth: queueDepth })
  }, [queueDepth])

  if (online) return null

  return (
    <OfflineBanner
      className="mb-0 rounded-none border-x-0 border-t-0"
      message={
        queueDepth > 0
          ? `You’re offline. Showing saved content. ${queueDepth} ${
              queueDepth === 1 ? 'change' : 'changes'
            } waiting to sync.`
          : 'You’re offline. Showing saved content.'
      }
    />
  )
}
