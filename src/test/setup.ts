import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * jsdom implements no layout engine and therefore ships no ResizeObserver.
 * The member carousel uses one to decide whether its cards overflow. A stub is
 * honest here rather than a cop-out: jsdom reports every width as 0, so the
 * callback could only ever re-derive the same answer it got on mount. Whether
 * the strip actually overflows is a question for a real browser.
 */
class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= NoopResizeObserver

// Ensure the DOM is reset between tests so renders don't leak into each other.
afterEach(() => {
  cleanup()
})
