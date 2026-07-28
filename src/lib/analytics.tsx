import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const apiKey = import.meta.env.VITE_POSTHOG_KEY
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export type CaptureFn = (event: string, properties?: Record<string, unknown>) => void

const noop: CaptureFn = () => {}

/**
 * Default is a no-op, so a component rendered outside the provider — in a unit
 * test, say — never crashes on capture. This replaced an earlier
 * `posthog?.capture(...)` pattern that looked safe but was not: outside a
 * provider the posthog-js react hook returns the module namespace, which is
 * truthy and has no `capture`, so the optional chain passed and then threw.
 */
const AnalyticsContext = createContext<CaptureFn>(noop)

interface QueuedEvent {
  event: string
  properties?: Record<string, unknown>
}

/**
 * Loads PostHog lazily and provides a capture function.
 *
 * posthog-js is ~45kb gzipped — a third of the landing-page JS budget — so it
 * is imported dynamically rather than at module load, keeping it out of the
 * main chunk entirely. Events fired before the SDK settles are buffered and
 * flushed, so nothing is lost to the race.
 *
 * With no VITE_POSTHOG_KEY the SDK is never fetched at all: no network calls,
 * no chunk, and capture stays a no-op.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [capture, setCapture] = useState<CaptureFn>(() => noop)
  const queue = useRef<QueuedEvent[]>([])

  useEffect(() => {
    if (!apiKey) {
      if (import.meta.env.DEV) {
        console.info('[analytics] PostHog disabled — set VITE_POSTHOG_KEY in .env.local to enable.')
      }
      return
    }

    let cancelled = false
    void import('posthog-js')
      .then(({ default: posthog }) => {
        if (cancelled) return
        posthog.init(apiKey, {
          api_host: apiHost,
          // Send pageviews on SPA history changes and capture time-on-page.
          capture_pageview: 'history_change',
          capture_pageleave: true,
          // Only create person profiles for identified users (privacy-friendly).
          person_profiles: 'identified_only',
          autocapture: true,
        })

        const live: CaptureFn = (event, properties) => posthog.capture(event, properties)
        for (const queued of queue.current) live(queued.event, queued.properties)
        queue.current = []
        setCapture(() => live)
      })
      .catch((error: unknown) => {
        // Analytics must never take the page down.
        console.warn('[analytics] PostHog failed to load', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Buffer until the SDK resolves, then hand off to the live capture function.
  const buffering = useRef<CaptureFn>((event, properties) => {
    queue.current.push({ event, properties })
  })
  const value = capture === noop && apiKey ? buffering.current : capture

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

/** Safe event capture. Always callable; a no-op when analytics is disabled. */
export function useCapture(): CaptureFn {
  return useContext(AnalyticsContext)
}
