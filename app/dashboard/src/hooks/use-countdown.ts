import { useEffect, useRef, useState } from 'react'

/**
 * Spec S-0.1 / S-0.3 countdown.
 *
 * The interval it returns is purely presentational — the **server** owns the
 * deadline, passed in as an absolute timestamp, so a reload or a reconnect
 * re-syncs instead of restarting the wait. That is why this takes `untilMs`
 * rather than a number of seconds to count down from.
 *
 * `announceAt` is the milestone list spec 11 asks for: the region announces at
 * 4 minutes, 1 minute and 30 seconds only, never once a second.
 */
export interface Countdown {
  seconds: number
  /** Text for an `aria-live="polite"` region, or `null` on a non-milestone tick. */
  announcement: string | null
}

export function useCountdown(
  untilMs: number | null,
  announceAt?: (seconds: number) => string | null,
) {
  const [seconds, setSeconds] = useState(() => remaining(untilMs))
  const lastAnnounced = useRef<number | null>(null)

  useEffect(() => {
    if (untilMs == null) {
      setSeconds(0)
      return
    }

    const tick = () => setSeconds(remaining(untilMs))
    tick()

    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [untilMs])

  useEffect(() => {
    lastAnnounced.current = null
  }, [untilMs])

  return {
    seconds,
    announcement: announcementFor(seconds, announceAt, lastAnnounced),
  } satisfies Countdown
}

function remaining(untilMs: number | null): number {
  if (untilMs == null) return 0
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000))
}

/**
 * A milestone is announced once. Passing 0 as the initial value would otherwise
 * announce nothing, which is the intent — the message is already on screen as
 * static text.
 */
function announcementFor(
  seconds: number,
  announceAt: ((seconds: number) => string | null) | undefined,
  lastAnnounced: { current: number | null },
): string | null {
  if (!announceAt) return null
  if (lastAnnounced.current === seconds) return null
  const text = announceAt(seconds)
  if (text == null) return null
  lastAnnounced.current = seconds
  return text
}
