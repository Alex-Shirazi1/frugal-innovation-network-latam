import { PostHogProvider } from 'posthog-js/react'
import type { ReactNode } from 'react'

const apiKey = import.meta.env.VITE_POSTHOG_KEY
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

/**
 * Wraps the app in PostHog analytics when a project key is configured.
 *
 * If VITE_POSTHOG_KEY is absent (e.g. local dev without a key, or the
 * local-first guardrail) it renders children untouched — no network calls,
 * no crash — so the site keeps working exactly as before.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.info(
        '[analytics] PostHog disabled — set VITE_POSTHOG_KEY in .env.local to enable.',
      )
    }
    return <>{children}</>
  }

  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{
        api_host: apiHost,
        // Send pageviews on SPA history changes and capture time-on-page.
        capture_pageview: 'history_change',
        capture_pageleave: true,
        // Only create person profiles for identified users (privacy-friendly).
        person_profiles: 'identified_only',
        autocapture: true,
      }}
    >
      {children}
    </PostHogProvider>
  )
}
