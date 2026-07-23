import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Ensure the DOM is reset between tests so renders don't leak into each other.
afterEach(() => {
  cleanup()
})
