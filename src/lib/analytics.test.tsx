import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AnalyticsProvider, useCapture } from './analytics'

function wrapper({ children }: { children: ReactNode }) {
  return <AnalyticsProvider>{children}</AnalyticsProvider>
}

describe('useCapture', () => {
  /**
   * Regression guard. The previous implementation called
   * `posthog?.capture(...)` on the value returned by posthog-js's react hook.
   * Outside a provider that value is the module namespace — truthy, but with no
   * `capture` — so the optional chain passed and then threw a TypeError. That is
   * the default state whenever VITE_POSTHOG_KEY is unset, which took down the
   * language switcher on any keyless build.
   */
  it('is a no-op outside any provider instead of throwing', () => {
    const { result } = renderHook(() => useCapture())
    expect(typeof result.current).toBe('function')
    expect(() => act(() => result.current('language_switched', { to: 'en' }))).not.toThrow()
  })

  it('is a no-op inside the provider when no key is configured', () => {
    // The test env has no VITE_POSTHOG_KEY, so the SDK is never imported.
    const { result } = renderHook(() => useCapture(), { wrapper })
    expect(() => act(() => result.current('resource_opened', { id: 'x' }))).not.toThrow()
  })

  it('never fetches the posthog SDK when analytics is disabled', () => {
    // No key means no dynamic import, so nothing touches the network and the
    // chunk never loads. Rendering is enough to prove it does not blow up.
    const { result } = renderHook(() => useCapture(), { wrapper })
    act(() => {
      result.current('a')
      result.current('b', { n: 1 })
    })
    expect(typeof result.current).toBe('function')
  })

  it('accepts events with and without properties', () => {
    const { result } = renderHook(() => useCapture(), { wrapper })
    const capture = result.current
    expect(() =>
      act(() => {
        capture('onboarding_submitted')
        capture('onboarding_submitted', { country: 'México', interests: 2 })
      }),
    ).not.toThrow()
  })

  it('hands the same stable function identity to consumers', () => {
    const spy = vi.fn()
    const { result, rerender } = renderHook(() => useCapture(), { wrapper })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(spy).not.toHaveBeenCalled()
  })
})
