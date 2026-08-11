/**
 * Signs a moderator out after a stretch of no interaction.
 *
 * Firebase refreshes an ID token silently for as long as the tab is open, so a
 * signed-in session left on screen stays valid indefinitely — nothing in the SDK
 * ever expires it. The moderators here are academics who may well be on a shared
 * department or lab machine, which makes "walked away with /admin open" the most
 * plausible way a live session gets handed to someone else.
 *
 * Activity-based rather than a fixed session cap on purpose: it only fires when
 * nobody is there, so it cannot interrupt someone halfway through an edit.
 */
import { useEffect, useRef } from 'react'

/**
 * Thirty minutes — long enough to read through a bibliography entry without
 * touching anything, short enough that a tab abandoned after lunch is not still
 * signed in that evening.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** How often the wall clock is consulted. Cheap; nowhere near the timeout. */
const CHECK_INTERVAL_MS = 30 * 1000

/**
 * What counts as presence. Covers keyboard, pointer, touch and scroll without
 * listening to anything that fires on its own. `mousemove` is included because
 * someone reading the page still moves the cursor, and every listener is passive
 * so none of this affects scroll performance.
 */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useIdleTimeout(
  onIdle: () => void,
  enabled: boolean,
  timeoutMs: number = IDLE_TIMEOUT_MS,
): void {
  /*
   * Held in a ref so that a re-render producing a new callback identity does not
   * tear down and restart the countdown. Without this, any parent state change —
   * switching tabs in the panel, say — would refresh the clock, and a session
   * could stay alive indefinitely while genuinely unattended.
   */
  const onIdleRef = useRef(onIdle)
  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  useEffect(() => {
    if (!enabled) return

    let lastActivity = Date.now()
    const markActive = () => {
      lastActivity = Date.now()
    }

    const checkIdle = () => {
      if (Date.now() - lastActivity >= timeoutMs) onIdleRef.current()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true })
    }

    /*
     * Compared against the wall clock rather than trusted to a single long
     * setTimeout. Browsers throttle timers in background tabs, and a suspended
     * laptop stops them altogether — either would let an abandoned session
     * outlive its timeout and then resume as if nothing happened. Re-checking
     * the timestamp on wake and on tab focus gets both cases right, and means a
     * machine that slept for hours signs out the moment it comes back.
     */
    document.addEventListener('visibilitychange', checkIdle)
    const poll = window.setInterval(checkIdle, CHECK_INTERVAL_MS)

    return () => {
      window.clearInterval(poll)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive)
      }
      document.removeEventListener('visibilitychange', checkIdle)
    }
  }, [enabled, timeoutMs])
}
