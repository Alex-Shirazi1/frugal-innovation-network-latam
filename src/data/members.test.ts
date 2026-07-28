import { describe, it, expect } from 'vitest'
import { mockMembers, institutionName } from './members'
import { institutions } from './institutions'
import {
  cityToRegion,
  countries,
  generalAreas,
  languageOptions,
  positionTypes,
  researchInterests,
} from './onboardingOptions'

const countryByName = new Map(countries.map((c) => [c.name, c]))

describe('seed member data integrity', () => {
  it('generates the full directory', () => {
    expect(mockMembers).toHaveLength(54)
    expect(new Set(mockMembers.map((m) => m.id)).size).toBe(54)
  })

  /**
   * The intake validator whitelists country/region pairs. Seed members bypass
   * that validator, so nothing else stops them drifting into pairs the form
   * would reject — which is how `region` ended up holding a city name.
   */
  it('every member has a country/region pair the intake validator would accept', () => {
    const invalid = mockMembers
      .filter((m) => !countryByName.get(m.country)?.regions.includes(m.region))
      .map((m) => `${m.fullName}: ${m.country}/${m.region}`)
    expect(invalid).toEqual([])
  })

  it('every member references known positions, interests, areas, and languages', () => {
    const interestIds = new Set(researchInterests.map((i) => i.id))
    const areaIds = new Set(generalAreas.map((a) => a.id))
    const langIds = new Set(languageOptions.map((l) => l.id))

    for (const m of mockMembers) {
      expect(positionTypes).toContain(m.position)
      expect(m.interestIds.every((id) => interestIds.has(id))).toBe(true)
      expect(m.generalAreaIds.every((id) => areaIds.has(id))).toBe(true)
      expect(m.languages.every((id) => langIds.has(id))).toBe(true)
    }
  })

  it('resolves every affiliation to a real institution, or null for independents', () => {
    const ids = new Set(institutions.map((i) => i.id))
    for (const m of mockMembers) {
      if (m.affiliationId === null) {
        expect(m.position).toBe('independent')
      } else {
        expect(ids.has(m.affiliationId)).toBe(true)
      }
    }
  })

  it('carries every field Allan asked for, non-empty', () => {
    for (const m of mockMembers) {
      expect(m.firstName.length).toBeGreaterThan(0)
      expect(m.lastName.length).toBeGreaterThan(0)
      expect(m.fullName).toBe(`${m.firstName} ${m.lastName}`)
      expect(m.jobPositionName.length).toBeGreaterThan(0)
      expect(m.biography.length).toBeGreaterThan(0)
      expect(m.interestIds.length).toBeGreaterThan(0)
      expect(m.generalAreaIds.length).toBeGreaterThan(0)
      expect(m.languages.length).toBeGreaterThan(0)
      expect(m.avatarHue).toBeGreaterThanOrEqual(0)
      expect(m.avatarHue).toBeLessThan(360)
    }
  })
})

describe('city to region map', () => {
  it('covers every mappable institution and resolves to a valid region', () => {
    const problems: string[] = []
    for (const inst of institutions) {
      if (!inst.coords) continue
      const region = cityToRegion[inst.city]
      if (!region) {
        problems.push(`unmapped city: ${inst.city} (${inst.country})`)
        continue
      }
      if (!countryByName.get(inst.country)?.regions.includes(region)) {
        problems.push(`${inst.country} has no region "${region}"`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe('institutionName', () => {
  it('resolves known ids and returns null otherwise', () => {
    expect(institutionName('iteso')).toContain('ITESO')
    expect(institutionName('nope')).toBeNull()
    expect(institutionName(null)).toBeNull()
  })
})
