import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PostHogProvider, usePostHog } from 'posthog-js/react'
import type { ReactNode } from 'react'
import { useCapture } from './analytics'

describe('useCapture', () => {
  /**
   * Regression guard. Outside a PostHogProvider, `usePostHog()` returns the
   * posthog-js module namespace — truthy, but with no `capture` method. The
   * naive `posthog?.capture(...)` guard passes and then throws a TypeError,
   * which took down the language switcher on any build without a PostHog key.
   */
  it('is a no-op outside a PostHogProvider instead of throwing', () => {
    const { result: raw } = renderHook(() => usePostHog())
    // Document the upstream shape this hook exists to defend against.
    expect(raw.current).not.toBeNull()
    expect(typeof (raw.current as unknown as Record<string, unknown>)?.capture).not.toBe('function')

    const { result } = renderHook(() => useCapture())
    expect(() => act(() => result.current('language_switched', { to: 'en' }))).not.toThrow()
  })

  it('forwards the event and properties when a provider is present', () => {
    const capture = vi.fn()
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <PostHogProvider client={{ capture } as never}>
          {children}
        </PostHogProvider>
      )
    }

    const { result } = renderHook(() => useCapture(), { wrapper })
    act(() => result.current('resource_opened', { resource_id: 'marco-relif' }))

    expect(capture).toHaveBeenCalledWith('resource_opened', { resource_id: 'marco-relif' })
  })
})
