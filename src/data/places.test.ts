import { describe, it, expect } from 'vitest'
import { countries, countryLabels, placeLabel, regionLabels } from './onboardingOptions'
import { mockMembers } from './members'
import { institutions } from './institutions'

describe('place labels', () => {
  /**
   * The stored value is the validation key used by the intake validator, the
   * generated Firestore rules, and every persisted member record. Translating it
   * in place would invalidate all three at once, so these are display-only.
   */
  it('covers every country in the whitelist', () => {
    const missing = countries.filter((c) => !countryLabels[c.name]).map((c) => c.name)
    expect(missing).toEqual([])
  })

  it('keeps the canonical Spanish name as the es label', () => {
    for (const country of countries) {
      expect(countryLabels[country.name].es).toBe(country.name)
    }
  })

  it('translates the countries that genuinely differ', () => {
    expect(placeLabel('México', 'en')).toBe('Mexico')
    expect(placeLabel('Brasil', 'en')).toBe('Brazil')
    expect(placeLabel('Estados Unidos', 'en')).toBe('United States')
    expect(placeLabel('Francia', 'en')).toBe('France')
    expect(placeLabel('Suiza', 'en')).toBe('Switzerland')
    expect(placeLabel('Colombia', 'pt')).toBe('Colômbia')
    expect(placeLabel('Nicaragua', 'pt')).toBe('Nicarágua')
    expect(placeLabel('Perú', 'en')).toBe('Peru')
  })

  it('translates regions where a real translation exists', () => {
    expect(placeLabel('Ciudad de México', 'en')).toBe('Mexico City')
    expect(placeLabel('Región Metropolitana', 'en')).toBe('Metropolitan Region')
    expect(placeLabel('Nueva York', 'en')).toBe('New York')
    expect(placeLabel('Ginebra', 'en')).toBe('Geneva')
  })

  /** Proper nouns read the same in all three languages; the fallback covers them. */
  it('falls back to the canonical value for proper nouns', () => {
    for (const lang of ['es', 'en', 'pt'] as const) {
      expect(placeLabel('Jalisco', lang)).toBe('Jalisco')
      expect(placeLabel('São Paulo', lang)).toBe('São Paulo')
      expect(placeLabel('Grand Est', lang)).toBe('Grand Est')
      expect(placeLabel('Uusimaa', lang)).toBe('Uusimaa')
    }
  })

  it('never returns an empty label for anything a member can store', () => {
    for (const lang of ['es', 'en', 'pt'] as const) {
      for (const member of mockMembers) {
        expect(placeLabel(member.country, lang)).toBeTruthy()
        expect(placeLabel(member.region, lang)).toBeTruthy()
      }
      // The map renders institution countries too.
      for (const institution of institutions) {
        expect(placeLabel(institution.country, lang)).toBeTruthy()
      }
    }
  })

  it('leaves an unknown value untouched rather than blanking it', () => {
    expect(placeLabel('Atlantis', 'en')).toBe('Atlantis')
    expect(placeLabel('', 'en')).toBe('')
  })

  it('provides all three languages for every label entry', () => {
    for (const entry of [...Object.values(countryLabels), ...Object.values(regionLabels)]) {
      expect(entry.es).toBeTruthy()
      expect(entry.en).toBeTruthy()
      expect(entry.pt).toBeTruthy()
    }
  })
})
