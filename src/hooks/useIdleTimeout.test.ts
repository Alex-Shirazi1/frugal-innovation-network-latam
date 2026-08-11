/**
 * The timing behaviour is the entire value of this hook, so it is asserted
 * rather than eyeballed — including the two cases a naive setTimeout gets
 * wrong: a re-render mid-countdown, and a machine that was suspended.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { IDLE_TIMEOUT_MS, useIdleTimeout } from './useIdleTimeout'

/** Advances both the fake timers and the wall clock the hook compares against. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useIdleTimeout', () => {
  beforeEach(() => {
    // Fake timers with a fixed origin so Date.now() moves with the timers.
    vi.useFakeTimers({ now: new Date('2026-08-11T12:00:00.000Z') })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire before the timeout elapses', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout(onIdle, true))

    advance(IDLE_TIMEOUT_MS - 1000)

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('fires once the timeout elapses with no activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout(onIdle, true))

    advance(IDLE_TIMEOUT_MS)

    expect(onIdle).toHaveBeenCalled()
  })

  it('never fires while disabled, so the login gate is unaffected', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout(onIdle, false))

    advance(IDLE_TIMEOUT_MS * 3)

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('restarts the countdown on interaction', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout(onIdle, true))

    advance(IDLE_TIMEOUT_MS - 1000)
    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    advance(IDLE_TIMEOUT_MS - 1000)

    expect(onIdle).not.toHaveBeenCalled()

    advance(2000)
    expect(onIdle).toHaveBeenCalled()
  })

  /*
   * The bug the ref indirection exists to prevent: a parent re-render hands the
   * hook a fresh callback identity, and a dependency on it would rebuild the
   * effect and silently reset the clock. Switching tabs in the panel would then
   * keep an unattended session alive forever.
   */
  it('keeps counting across a re-render with a new callback identity', () => {
    const onIdle = vi.fn()
    const { rerender } = renderHook(({ cb }) => useIdleTimeout(cb, true), {
      initialProps: { cb: () => onIdle() },
    })

    advance(IDLE_TIMEOUT_MS - 1000)
    rerender({ cb: () => onIdle() })
    advance(2000)

    expect(onIdle).toHaveBeenCalled()
  })

  /*
   * Background tabs get their timers throttled and a suspended laptop stops them
   * outright, so the hook compares wall-clock timestamps instead of trusting a
   * timer to have fired. Simulated here by jumping the clock without running the
   * interval, then delivering the visibilitychange that a wake produces.
   */
  it('signs out on wake after the clock jumped past the timeout', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout(onIdle, true))

    act(() => {
      vi.setSystemTime(new Date(Date.now() + IDLE_TIMEOUT_MS + 60_000))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(onIdle).toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const onIdle = vi.fn()
    const { unmount } = renderHook(() => useIdleTimeout(onIdle, true))

    unmount()
    advance(IDLE_TIMEOUT_MS * 2)

    expect(onIdle).not.toHaveBeenCalled()
  })
})
