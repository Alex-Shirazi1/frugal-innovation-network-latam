import { describe, it, expect } from 'vitest'
import { bibliography, bibliographyYears } from './bibliography'

describe('bibliography', () => {
  it('holds the full compilation', () => {
    expect(bibliography).toHaveLength(43)
    expect(new Set(bibliography.map((e) => e.id)).size).toBe(43)
    expect(new Set(bibliography.map((e) => e.paperNumber)).size).toBe(43)
  })

  it('has a title, authors and a plausible size for every entry', () => {
    for (const entry of bibliography) {
      expect(entry.title.length).toBeGreaterThan(5)
      expect(entry.authors.length).toBeGreaterThan(2)
      expect(entry.sizeKb).toBeGreaterThan(10)
      expect(entry.file.startsWith('/docs/biblio/')).toBe(true)
      expect(entry.file.endsWith('.pdf')).toBe(true)
    }
  })

  it('has no newlines left over from the source spreadsheet', () => {
    for (const entry of bibliography) {
      expect(entry.title).not.toMatch(/[\r\n]/)
      expect(entry.authors).not.toMatch(/[\r\n]/)
    }
  })

  /**
   * Two source rows genuinely have "- " in the year column, so null is correct
   * — but everything else should have parsed to a real year.
   */
  it('parses years where the source has one, and null where it does not', () => {
    const undated = bibliography.filter((e) => e.year === null)
    expect(undated.map((e) => e.paperNumber).sort()).toEqual(['028', '031'])
    for (const entry of bibliography) {
      if (entry.year !== null) {
        expect(entry.year).toBeGreaterThan(1950)
        expect(entry.year).toBeLessThan(2050)
      }
    }
  })

  it('classifies every entry as EN or ES', () => {
    for (const entry of bibliography) {
      expect(['EN', 'ES']).toContain(entry.language)
    }
    expect(bibliography.filter((e) => e.language === 'ES').length).toBeGreaterThan(0)
  })

  it('exposes years newest-first for the filter', () => {
    expect(bibliographyYears.length).toBeGreaterThan(5)
    const sorted = [...bibliographyYears].sort((a, b) => b - a)
    expect(bibliographyYears).toEqual(sorted)
  })

  it('uses url-safe slugs with no spaces or accents', () => {
    for (const entry of bibliography) {
      expect(entry.file).toMatch(/^\/docs\/biblio\/[a-z0-9-]+\.pdf$/)
    }
  })
})
