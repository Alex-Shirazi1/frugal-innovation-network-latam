import { describe, it, expect } from 'vitest'
import { es, en, pt } from './translations'

// Recursively collect the dot-path of every leaf string in a dictionary so we
// can assert the three language dictionaries are structurally identical.
function leafPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') {
    return [prefix]
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    leafPaths(value, prefix ? `${prefix}.${key}` : key),
  )
}

describe('translation dictionaries', () => {
  it('es, en and pt expose the exact same set of keys', () => {
    const esPaths = leafPaths(es).sort()
    const enPaths = leafPaths(en).sort()
    const ptPaths = leafPaths(pt).sort()
    expect(enPaths).toEqual(esPaths)
    expect(ptPaths).toEqual(esPaths)
  })

  it('has no empty string values in any language', () => {
    for (const dict of [es, en, pt]) {
      const emptyLeaves = leafPaths(dict).filter((path) => {
        const value = path.split('.').reduce<unknown>(
          (acc, key) => (acc as Record<string, unknown>)?.[key],
          dict,
        )
        return typeof value === 'string' && value.trim() === ''
      })
      expect(emptyLeaves).toEqual([])
    }
  })

  it('exposes localized navigation labels that differ across languages', () => {
    expect(es.nav.join).toBe('Únete a la Red')
    expect(en.nav.join).not.toBe(es.nav.join)
    expect(pt.nav.join).not.toBe(en.nav.join)
  })
})
