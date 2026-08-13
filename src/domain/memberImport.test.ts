/**
 * The mapping is the whole risk in this feature. A parser bug or an unmatched
 * label does not throw — it quietly produces a member who was vetted, told they
 * would appear, and then did not. So every vocabulary, every affirmative
 * spelling, and every failure path is asserted rather than assumed.
 */
import { describe, expect, it } from 'vitest'
import { importMembersFromCsv, mapFormResponse, parseCsv, rowToSubmission } from './memberImport'

const HEADERS =
  'Nombre completo,Correo electrónico,Cargo,Puesto,Biografía,Institución,País,Región,Intereses,Áreas generales,Idiomas,LinkedIn,Consentimiento'

const ROW = [
  'Ada Lovelace',
  'ada@example.org',
  'Investigador/a',
  'Investigadora Asociada',
  'Trabaja en innovación frugal.',
  'ITESO',
  'México',
  'Jalisco',
  '"Salud frugal, Energía asequible"',
  'Ingeniería',
  '"Español, Inglés"',
  'https://linkedin.com/in/ada',
  'Sí',
].join(',')

function importOne(row = ROW, headers = HEADERS) {
  const result = importMembersFromCsv(`${headers}\n${row}`)
  return result.rows[0]
}

describe('parseCsv', () => {
  it('reads quoted fields containing commas', () => {
    const [row] = parseCsv('a,"b,c",d')
    expect(row).toEqual(['a', 'b,c', 'd'])
  })

  it('unescapes doubled quotes inside a quoted field', () => {
    const [row] = parseCsv('a,"say ""hi""",c')
    expect(row).toEqual(['a', 'say "hi"', 'c'])
  })

  it('handles CRLF without producing blank rows', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('strips a leading byte order mark, which Sheets emits', () => {
    const [row] = parseCsv('﻿Nombre,Apellido')
    expect(row[0]).toBe('Nombre')
  })

  it('keeps a newline that appears inside a quoted field', () => {
    const [row] = parseCsv('a,"line one\nline two"')
    expect(row[1]).toBe('line one\nline two')
  })

  it('reads a final row that has no trailing newline', () => {
    expect(parseCsv('a,b\nc,d')).toHaveLength(2)
  })
})

describe('importMembersFromCsv', () => {
  it('imports a well-formed Spanish-headed export', () => {
    const row = importOne()
    expect(row.ok).toBe(true)
    expect(row.member?.fullName).toBe('Ada Lovelace')
    expect(row.member?.email).toBe('ada@example.org')
    expect(row.member?.affiliationId).toBe('iteso')
    expect(row.unresolved).toEqual([])
  })

  it('derives display fields rather than trusting the sheet', () => {
    const row = importOne()
    // fullName, title and avatarHue are computed by the canonical validator.
    expect(row.member?.fullName).toBe('Ada Lovelace')
    expect(row.member?.title.es).toBeTruthy()
    expect(row.member?.avatarHue).toBeGreaterThanOrEqual(0)
    expect(row.member?.avatarHue).toBeLessThan(360)
  })

  it('splits multi-select answers and resolves each label to an id', () => {
    const row = importOne()
    expect(row.member?.interestIds).toEqual(['salud', 'energia'])
    expect(row.member?.languages).toEqual(['es', 'en'])
    expect(row.member?.generalAreaIds).toEqual(['ingenieria'])
  })

  it('matches labels whether or not the accents were typed', () => {
    const withoutAccents = ROW.replace('"Salud frugal, Energía asequible"', '"Salud frugal, Energia asequible"')
    expect(importOne(withoutAccents).member?.interestIds).toEqual(['salud', 'energia'])
  })

  it('accepts English or Portuguese labels, and raw ids', () => {
    const english = ROW.replace('"Salud frugal, Energía asequible"', '"Frugal healthcare, Affordable energy"')
    expect(importOne(english).member?.interestIds).toEqual(['salud', 'energia'])
    const ids = ROW.replace('"Salud frugal, Energía asequible"', '"salud, energia"')
    expect(importOne(ids).member?.interestIds).toEqual(['salud', 'energia'])
  })

  it('tolerates Google Forms help text appended to a question header', () => {
    const verbose = HEADERS.replace('Idiomas', 'Idiomas (selecciona todos los que apliquen)')
    expect(importOne(ROW, verbose).member?.languages).toEqual(['es', 'en'])
  })

  it('reports unrecognised headers instead of guessing at them', () => {
    const result = importMembersFromCsv(`Marca temporal,${HEADERS}\n2026-08-11,${ROW}`)
    expect(result.ignoredHeaders).toContain('Marca temporal')
    expect(result.rows[0].ok).toBe(true)
  })

  /*
   * Consent is the one field where a wrong guess is a privacy incident, so the
   * affirmative list is explicit and anything outside it counts as no.
   */
  it('accepts the affirmative spellings a trilingual form produces', () => {
    for (const yes of ['Sí', 'si', 'SI', 'Yes', 'Sim', 'TRUE', '1', 'Acepto']) {
      const row = importOne(ROW.replace(/,Sí$/, `,${yes}`))
      expect(row.ok, `expected "${yes}" to count as consent`).toBe(true)
    }
  })

  it('refuses a row whose consent box was left blank or negative', () => {
    for (const no of ['', 'No', 'Não', 'false', 'maybe']) {
      const row = importOne(ROW.replace(/,Sí$/, `,${no}`))
      expect(row.ok, `expected "${no}" to be refused`).toBe(false)
      expect(row.error).toBe('consent-required')
    }
  })

  it('resolves a position from its localized descriptor or its id', () => {
    expect(importOne(ROW.replace('Investigador/a', 'researcher')).member?.position).toBe('researcher')
    expect(importOne(ROW.replace('Investigador/a', 'Researcher')).member?.position).toBe('researcher')
  })

  it('translates a city in the region column into its region', () => {
    const withCity = ROW.replace(',México,Jalisco,', ',México,Guadalajara,')
    const row = importOne(withCity)
    expect(row.ok).toBe(true)
    expect(row.member?.region).toBe('Jalisco')
  })

  it('flags an institution that is not on the whitelist without dropping the row', () => {
    const row = importOne(ROW.replace(',ITESO,', ',Universidad Inventada,'))
    expect(row.unresolved).toContain('Universidad Inventada')
    // Still importable — it simply carries no affiliation rather than a wrong one.
    expect(row.member?.affiliationId).toBeNull()
  })

  it('matches a short institution name against its long official title', () => {
    // The whitelist says "ITESO, Universidad Jesuita de Guadalajara".
    expect(importOne(ROW.replace(',ITESO,', ',ITESO,')).member?.affiliationId).toBe('iteso')
  })

  /*
   * "Universidad Iberoamericana" is the leading part of five different network
   * institutions and the exact name of none of them. Picking one would file a
   * person under the wrong campus, so ambiguity surfaces instead of resolving.
   */
  it('refuses to guess between institutions sharing a name prefix', () => {
    const row = importOne(ROW.replace(',ITESO,', ',Universidad Iberoamericana,'))
    expect(row.member?.affiliationId).toBeNull()
    expect(row.unresolved).toContain('Universidad Iberoamericana')
  })

  /*
   * Documents a real hazard rather than asserting it away. "Universidad
   * Centroamericana" is the exact name of the Nicaraguan member and the leading
   * part of the Salvadoran one, so an exact match wins and resolves to Nicaragua.
   * Someone from UCA El Salvador who types only the shared part is filed under the
   * wrong country. The form should offer these as picklist options rather than
   * free text; until it does, this is the behaviour to know about.
   */
  it('prefers an exact institution name over a longer partial match', () => {
    const row = importOne(ROW.replace(',ITESO,', ',Universidad Centroamericana,'))
    expect(row.member?.affiliationId).toBe('uca-ni')
  })

  it('reports a malformed email as such rather than as a generic failure', () => {
    expect(importOne(ROW.replace('ada@example.org', 'not-an-email')).error).toBe('invalid-email')
  })

  it('refuses a region that does not belong to the stated country', () => {
    expect(importOne(ROW.replace(',México,Jalisco,', ',México,Atlantis,')).error).toBe(
      'invalid-location',
    )
  })

  it('reports every row, so nothing is silently dropped', () => {
    const good = ROW
    const bad = ROW.replace('ada@example.org', 'broken')
    const result = importMembersFromCsv(`${HEADERS}\n${good}\n${bad}\n${good}`)
    expect(result.rows).toHaveLength(3)
    expect(result.rows.map((row) => row.ok)).toEqual([true, false, true])
    expect(result.rows.map((row) => row.row)).toEqual([1, 2, 3])
  })

  it('skips wholly blank rows that a sheet export leaves behind', () => {
    const result = importMembersFromCsv(`${HEADERS}\n${ROW}\n,,,,,,,,,,,,,\n`)
    expect(result.rows).toHaveLength(1)
  })

  it('says so when no column is recognised at all', () => {
    const result = importMembersFromCsv('alpha,beta\n1,2')
    expect(result.rows[0].error).toBe('no-recognised-columns')
  })

  it('returns nothing for an empty file rather than throwing', () => {
    expect(importMembersFromCsv('')).toEqual({ headers: [], ignoredHeaders: [], rows: [] })
  })
})

/**
 * The Apps Script transport posts a response verbatim and maps nothing, so these
 * cover the shape that actually arrives from Google rather than a file export.
 */
describe('mapFormResponse', () => {
  const RESPONSE: Record<string, string> = {
    'Marca temporal': '2026-08-11 21:04:12',
    'Nombre completo': 'Ada Lovelace',
    'Correo electrónico': 'ada@example.org',
    Cargo: 'Investigador/a',
    Puesto: 'Investigadora Asociada',
    Biografía: 'Trabaja en innovación frugal.',
    Institución: 'ITESO',
    País: 'México',
    Región: 'Jalisco',
    Intereses: 'Salud frugal, Energía asequible',
    'Áreas generales': 'Ingeniería',
    'Idiomas (selecciona todos los que apliquen)': 'Español, Inglés',
    LinkedIn: 'https://linkedin.com/in/ada',
    Consentimiento: 'Sí',
  }

  it('maps a verbatim form response into a validated member', () => {
    const result = mapFormResponse(RESPONSE)
    expect(result.ok).toBe(true)
    expect(result.member?.fullName).toBe('Ada Lovelace')
    expect(result.member?.interestIds).toEqual(['salud', 'energia'])
    expect(result.member?.affiliationId).toBe('iteso')
    expect(result.unresolved).toEqual([])
  })

  it('ignores Google bookkeeping fields like the timestamp', () => {
    // 'Marca temporal' maps to no field and must not break the response.
    expect(mapFormResponse(RESPONSE).ok).toBe(true)
  })

  it('withholds consent when the question is absent entirely', () => {
    const { Consentimiento: _dropped, ...withoutConsent } = RESPONSE
    const result = mapFormResponse(withoutConsent)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('consent-required')
  })

  it('reports a response with no recognisable questions', () => {
    expect(mapFormResponse({ alpha: '1', beta: '2' }).error).toBe('no-recognised-columns')
  })

  /*
   * Taken from the live "Formulario de Membresía". Several aliases are prefixes
   * of longer ones, and matching on the first registered filed this question
   * under the name field — where the name question then overwrote it, dropping the
   * institution with nothing in `unresolved` to show a moderator. The longest
   * alias has to win.
   */
  it('reads an organisation question as the affiliation, not as a first name', () => {
    const { Institución: _replaced, ...rest } = RESPONSE
    const result = mapFormResponse({
      'Nombre de la organización:': 'ITESO',
      ...rest,
    })
    expect(result.ok).toBe(true)
    expect(result.member?.affiliationId).toBe('iteso')
    expect(result.member?.fullName).toBe('Ada Lovelace')
  })

  it('still reads a bare name question as the first name', () => {
    // The longest-match rule must not cost the plain spellings their meaning.
    expect(mapFormResponse(RESPONSE).member?.fullName).toBe('Ada Lovelace')
    expect(
      mapFormResponse({ ...RESPONSE, Nombre: 'Ada Lovelace' }).member?.fullName,
    ).toBe('Ada Lovelace')
  })

  it('survives a non-string answer without throwing', () => {
    const result = mapFormResponse({ ...RESPONSE, Región: null as unknown as string })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('invalid-location')
  })
})

describe('rowToSubmission', () => {
  /*
   * fullName is carried through — it is what the member typed, not something
   * the system computes. title, avatarHue and status stay off the submission so
   * a sheet cannot dictate how a profile presents itself; the validator derives
   * those from the position whitelist and the name.
   */
  it('never carries a display field through from the source record', () => {
    const { submission } = rowToSubmission({ fullName: 'Ada Lovelace' })
    expect(submission.fullName).toBe('Ada Lovelace')
    expect(submission).not.toHaveProperty('title')
    expect(submission).not.toHaveProperty('avatarHue')
    expect(submission).not.toHaveProperty('status')
  })
})
