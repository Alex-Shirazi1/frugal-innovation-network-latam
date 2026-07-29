import { describe, it, expect } from 'vitest'
import {
  commissions,
  initiativeLinks,
  networkEmails,
  networkValues,
  regionalContacts,
  socialLinks,
} from './network'
import { es, en, pt } from '../i18n/translations'
import { initiativeOrder } from '../components/sections/InitiativesSection'

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

describe('initiative links', () => {
  /**
   * The dictionaries store initiatives as parallel arrays and the component
   * joins them to destinations by index. If someone adds an initiative to the
   * translations without extending initiativeOrder, the wrong card would get
   * the wrong link — or a link would silently vanish.
   */
  it('stays aligned with the translated initiative lists', () => {
    for (const lang of langs) {
      expect(dictionaries[lang].initiatives.items).toHaveLength(initiativeOrder.length)
    }
  })

  it('only references keys that exist in initiativeLinks', () => {
    for (const key of initiativeOrder) {
      expect(Object.hasOwn(initiativeLinks, key)).toBe(true)
    }
  })

  it('gives the podcast, cases and MOOC real destinations with translated CTAs', () => {
    for (const key of ['podcast', 'casos', 'mooc'] as const) {
      const link = initiativeLinks[key]
      expect(link, `${key} should have a destination`).toBeDefined()
      expect(link!.url.startsWith('https://')).toBe(true)
      for (const lang of langs) expect(link!.cta[lang]).toBeTruthy()
    }
  })

  it('points the podcast at Spotify and the cases at YouTube', () => {
    expect(initiativeLinks.podcast!.url).toContain('open.spotify.com')
    expect(initiativeLinks.casos!.url).toContain('youtube.com')
    expect(initiativeLinks.mooc!.url).toContain('edx.org')
  })
})
