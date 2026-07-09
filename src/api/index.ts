import type { RelifDataSource } from './dataSource'
import { bundledDataSource } from './adapters/bundled'
import { createHttpDataSource } from './adapters/http'
import { createFallbackDataSource } from './fallback'

export type { RelifDataSource } from './dataSource'
export * from './types'

/**
 * Selects the active data source:
 *  - VITE_DATA_SOURCE=bundled → compiled-in data only (static hosting mode)
 *  - default → HTTP backend at VITE_API_BASE_URL (default /api), silently
 *    falling back to bundled data when no backend is reachable.
 */
export function createDataSource(): RelifDataSource {
  if (import.meta.env.VITE_DATA_SOURCE === 'bundled') {
    return bundledDataSource
  }
  return createFallbackDataSource(createHttpDataSource(), bundledDataSource, (method, error) => {
    console.warn(`[relif-api] ${method} unreachable, using bundled data`, error)
  })
}
