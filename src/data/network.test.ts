import { describe, it, expect } from 'vitest'
import {
  commissions,
  networkEmails,
  networkValues,
  regionalContacts,
  socialLinks,
} from './network'
import { socialIconPaths } from './socialIcons'
import { es, en, pt } from '../i18n/translations'

const dictionaries = { es, en, pt } as const
const langs = ['es', 'en', 'pt'] as const

describe('social links', () => {
  it('covers every channel the production site publishes', () => {
    const ids = socialLinks.map((s) => s.id).sort()
    expect(ids).toEqual(
      ['facebook', 'instagram', 'linkedin', 'linktree', 'spotify', 'twitter', 'youtube'].sort(),
    )
  })

  it('points at absolute https destinations', () => {
    for (const social of socialLinks) {
      expect(social.url.startsWith('https://')).toBe(true)
      expect(() => new URL(social.url)).not.toThrow()
      expect(social.label).toBeTruthy()
      expect(social.handle).toBeTruthy()
    }
  })

  it('has no duplicate ids or urls', () => {
    expect(new Set(socialLinks.map((s) => s.id)).size).toBe(socialLinks.length)
    expect(new Set(socialLinks.map((s) => s.url)).size).toBe(socialLinks.length)
  })
})

describe('social glyphs', () => {
  /**
   * These paths were originally hand-approximated and rendered visibly
   * malformed (Instagram and Linktree especially). They now come from the
   * simple-icons dataset, extracted at authoring time.
   */
  it('has a glyph for every social link', () => {
    const missing = socialLinks.filter((s) => !socialIconPaths[s.id]).map((s) => s.id)
    expect(missing).toEqual([])
  })

  it('has plausible SVG path data on a 24x24 viewBox', () => {
    for (const social of socialLinks) {
      const path = socialIconPaths[social.id]
      // Starts with a moveto — absolute (M) or relative (m) are both valid.
      expect(/^[Mm]/.test(path)).toBe(true)
      expect(path.length).toBeGreaterThan(100)
      // Only valid SVG path characters — catches truncation and stray text.
      expect(path).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9,.\s-]+$/)
    }
  })

  it('gives every glyph a distinct shape', () => {
    const paths = socialLinks.map((s) => socialIconPaths[s.id])
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('regional contacts', () => {
  it('lists all five regional leads', () => {
    expect(regionalContacts).toHaveLength(5)
    expect(new Set(regionalContacts.map((c) => c.id)).size).toBe(5)
  })

  it('has a plausible email for every contact', () => {
    for (const contact of regionalContacts) {
      expect(contact.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i)
      expect(contact.name).toBeTruthy()
      expect(contact.city).toBeTruthy()
    }
  })

  it('translates region and role into all three languages', () => {
    for (const contact of regionalContacts) {
      for (const lang of langs) {
        expect(contact.region[lang]).toBeTruthy()
        expect(contact.role[lang]).toBeTruthy()
      }
    }
  })

  it('publishes both network inboxes', () => {
    expect(networkEmails.general).toMatch(/@/)
    expect(networkEmails.alternate).toMatch(/@/)
    expect(networkEmails.general).not.toBe(networkEmails.alternate)
  })
})

describe('about content', () => {
  it('carries the five published values in all three languages', () => {
    expect(networkValues).toHaveLength(5)
    for (const value of networkValues) {
      for (const lang of langs) {
        expect(value.name[lang]).toBeTruthy()
        expect(value.text[lang]).toBeTruthy()
      }
    }
  })

  it('carries the four commissions in all three languages', () => {
    expect(commissions).toHaveLength(4)
    for (const commission of commissions) {
      for (const lang of langs) expect(commission[lang]).toBeTruthy()
    }
  })

  it('has mission and vision copy in every dictionary', () => {
    for (const lang of langs) {
      const d = dictionaries[lang]
      expect(d.about.mission.length).toBeGreaterThan(80)
      expect(d.about.vision.length).toBeGreaterThan(80)
      expect(d.about.valuesTitle).toBeTruthy()
      expect(d.about.commissionsTitle).toBeTruthy()
    }
  })
})

