import { describe, expect, it } from 'vitest'
import { initiatives, localizeText, type EditableText } from './initiatives'

const langs = ['es', 'en', 'pt'] as const

describe('initiatives seed', () => {
  /**
   * These six were migrated out of the i18n dictionaries when the section
   * became editable. The content is real published copy, so the migration
   * losing or truncating one would be a regression on the live site, not just
   * a broken fixture.
   */
  it('carries the published initiatives, including the annual meeting', () => {
    expect(initiatives.map((i) => i.id)).toEqual([
      'encuentros',
      'podcast',
      'casos',
      'mooc',
      'investigacion',
      'herramientas',
      'encuentro-anual',
    ])
  })

  /**
   * The 2021 recordings used to be embedded inside the congress card, which
   * read as if they were congress sessions — they are the virtual annual
   * meeting, a different event. Allan's call was that a link on a card is
   * enough, so they live here now and the congress card carries only the
   * congress.
   */
  it('links the annual meeting to its recording', () => {
    const annual = initiatives.find((i) => i.id === 'encuentro-anual')
    expect(annual?.url).toContain('youtube.com')
    expect(annual?.text.es).toContain('2021')
  })

  it('gives every initiative all three translations, since these were already translated', () => {
    for (const initiative of initiatives) {
      for (const lang of langs) {
        expect(initiative.title[lang], `${initiative.id} title.${lang}`).toBeTruthy()
        expect(initiative.text[lang], `${initiative.id} text.${lang}`).toBeTruthy()
      }
    }
  })

  it('sorts by an order field rather than relying on array position', () => {
    const orders = initiatives.map((i) => i.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(new Set(orders).size).toBe(orders.length)
  })

  /**
   * A link with no label renders the bare URL, and a label with no link renders
   * nothing at all — either is a visible defect, so they travel together.
   */
  it('pairs every destination with a call to action', () => {
    for (const initiative of initiatives) {
      expect(Boolean(initiative.url), `${initiative.id}`).toBe(Boolean(initiative.cta))
    }
  })

  it('points the podcast, cases and MOOC at real https destinations', () => {
    for (const id of ['podcast', 'casos', 'mooc']) {
      const initiative = initiatives.find((i) => i.id === id)
      expect(initiative?.url, `${id} should have a destination`).toBeTruthy()
      expect(initiative?.url?.startsWith('https://')).toBe(true)
    }
  })

  it('leaves the annual gatherings unlinked, since the congress section covers them', () => {
    expect(initiatives.find((i) => i.id === 'encuentros')?.url).toBeNull()
  })
})

describe('localizeText', () => {
  const full: EditableText = { es: 'Hola', en: 'Hello', pt: 'Olá' }

  it('returns the requested language when present', () => {
    expect(localizeText(full, 'en')).toBe('Hello')
    expect(localizeText(full, 'pt')).toBe('Olá')
  })

  /**
   * The admin panel only requires Spanish. Without this fallback a card added
   * by the network would render blank for English and Portuguese readers —
   * worse than showing them the Spanish the network actually wrote.
   */
  it('falls back to Spanish when a translation was never supplied', () => {
    expect(localizeText({ es: 'Solo español' }, 'en')).toBe('Solo español')
    expect(localizeText({ es: 'Solo español' }, 'pt')).toBe('Solo español')
  })

  it('treats a blank translation as absent, not as an empty card', () => {
    expect(localizeText({ es: 'Respaldo', en: '   ' }, 'en')).toBe('Respaldo')
  })
})
