import { describe, it, expect } from 'vitest'
import { seedMembers, institutionName } from './members'
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
  it('carries a directory with unique ids', () => {
    expect(seedMembers.length).toBeGreaterThan(0)
    expect(new Set(seedMembers.map((m) => m.id)).size).toBe(seedMembers.length)
  })

  /**
   * The carousel shows the whole list at once, so a repeated name reads as a
   * rendering bug rather than as two people.
   */
  it('gives every member a distinct name', () => {
    const names = seedMembers.map((m) => m.fullName)
    const repeated = names.filter((name, i) => names.indexOf(name) !== i)
    expect(repeated).toEqual([])
  })

  /**
   * These are real people, and the directory is world-readable. The Member
   * record has no email or telephone field precisely so contact details cannot
   * ride along into the public bundle — this asserts none arrived by another
   * route, e.g. pasted into a biography or a job title.
   */
  it('publishes no contact details', () => {
    const contact = /[\w.+-]+@[\w-]+\.\w+|\+\d[\d\s()-]{7,}/
    const leaked = seedMembers
      .filter((m) => contact.test(`${m.biography} ${m.jobPositionName} ${m.fullName}`))
      .map((m) => m.fullName)
    expect(leaked).toEqual([])
  })

  it('links only to real profile URLs', () => {
    const bad = seedMembers
      .filter((m) => m.socialUrl !== undefined && !/^https:\/\//.test(m.socialUrl))
      .map((m) => `${m.fullName}: ${m.socialUrl}`)
    expect(bad).toEqual([])
  })

  /**
   * The intake validator whitelists country/region pairs. Seed members bypass
   * that validator, so nothing else stops them drifting into pairs the form
   * would reject — which is how `region` ended up holding a city name.
   */
  it('every member has a country/region pair the intake validator would accept', () => {
    const invalid = seedMembers
      .filter((m) => !countryByName.get(m.country)?.regions.includes(m.region))
      .map((m) => `${m.fullName}: ${m.country}/${m.region}`)
    expect(invalid).toEqual([])
  })

  it('every member references known positions, interests, areas, and languages', () => {
    const interestIds = new Set(researchInterests.map((i) => i.id))
    const areaIds = new Set(generalAreas.map((a) => a.id))
    const langIds = new Set(languageOptions.map((l) => l.id))

    for (const m of seedMembers) {
      expect(positionTypes).toContain(m.position)
      expect(m.interestIds.every((id) => interestIds.has(id))).toBe(true)
      expect(m.generalAreaIds.every((id) => areaIds.has(id))).toBe(true)
      expect(m.languages.every((id) => langIds.has(id))).toBe(true)
    }
  })

  it('resolves every affiliation to a real institution, or null for independents', () => {
    const ids = new Set(institutions.map((i) => i.id))
    for (const m of seedMembers) {
      if (m.affiliationId === null) {
        expect(m.position).toBe('independent')
      } else {
        expect(ids.has(m.affiliationId)).toBe(true)
      }
    }
  })

  it('carries every field Allan asked for, non-empty', () => {
    for (const m of seedMembers) {
      expect(m.fullName.trim().length).toBeGreaterThan(0)
      expect(m.fullName.split(' ').length).toBeGreaterThan(1)
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
