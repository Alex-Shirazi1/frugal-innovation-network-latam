/**
 * Turns a Google Form response export into validated member records.
 *
 * This is the pipeline the panel's approve button was removed in favour of. The
 * network does not admit people from a screen: someone reads the notification
 * email, writes back, has a call, asks for the organisation's logo and a letter,
 * and only then sends the private incorporation form. Filling THAT in is what
 * creates a profile — so by the time a row reaches this module the vetting has
 * already happened offline, and what is left is mechanical.
 *
 * Deliberately pure: no DOM, no Firestore, no fetch. Everything here is a
 * function of its input, which is what makes the mapping testable without an
 * emulator or a browser.
 *
 * The validation itself is NOT reimplemented. Every row goes through
 * validateIntake, the same canonical validator the public form and the dev
 * server use, so an imported member cannot enter by a path with weaker rules
 * than a self-submitted one. Firestore rules then check the shape a third time
 * on write, which is the only check a client cannot skip.
 */
import { validateIntake, positionTitles, type IntakeErrorCode, type ValidatedIntake } from './intake'
import {
  countries,
  cityToRegion,
  generalAreas,
  languageOptions,
  positionTypes,
  researchInterests,
} from '../data/onboardingOptions'
import { institutions } from '../data/institutions'

/** Reasons a row cannot be imported, on top of the intake validator's own. */
export type ImportErrorCode = IntakeErrorCode | 'empty-row' | 'no-recognised-columns'

export interface ImportRow {
  /** 1-based position in the file with the header excluded, for error messages. */
  row: number
  ok: boolean
  error?: ImportErrorCode
  member?: ValidatedIntake
  /**
   * Cell values that matched no known option, e.g. an institution not on the
   * whitelist. Surfaced so a human can resolve them rather than having the row
   * silently dropped — the failure mode this module exists to avoid.
   */
  unresolved: string[]
}

export interface ImportResult {
  headers: string[]
  /** Headers that mapped to no known field. Usually Google's "Timestamp". */
  ignoredHeaders: string[]
  rows: ImportRow[]
}

/**
 * Accent- and case-insensitive comparison key.
 *
 * Every label in this project exists in Spanish, and Google Forms answers are
 * typed or picked by people who may or may not have accents on. Matching
 * "Energia asequible" against "Energía asequible" is the difference between an
 * import that works and one that rejects half its rows for no visible reason.
 */
function key(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Minimal RFC 4180 reader: quoted fields, doubled quotes inside them, CRLF or
 * LF line endings, and a leading BOM. Sheets emits all four.
 *
 * Hand-written rather than taken from a dependency because the whole grammar is
 * the twenty lines below, and this file is the only caller.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\ufeff/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // Swallow the LF of a CRLF pair so it does not open an empty row.
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  // A file not ending in a newline still has one row left in the buffer.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Header spellings mapped onto our field names.
 *
 * Google Form column headers are the question text, so they arrive in Spanish
 * and in whatever wording the form uses. These are the spellings worth
 * anticipating; anything unmatched is reported as an ignored header rather than
 * guessed at, so a renamed question shows up as a visible gap.
 */
const ALIASES = {
  /*
   * One name field. The older spellings for a split name are kept as aliases
   * because a form that still asks "Nombre" alone should map to the whole name
   * rather than to nothing — but a response carrying BOTH a given-name and a
   * surname question now collapses to whichever appears last, which is why the
   * form asks for "Nombre completo" instead.
   */
  fullName: [
    'fullname',
    'full name',
    'nombre completo',
    'nombre y apellidos',
    'nombre y apellidos completos',
    'nombre',
    'nombres',
    'nome',
    'nome completo',
  ],
  email: ['email', 'e-mail', 'correo', 'correo electronico', 'email address', 'e-mail address'],
  position: ['position', 'cargo', 'tipo de cargo', 'posicion', 'rol', 'role'],
  jobPositionName: [
    'jobpositionname',
    'job title',
    'puesto',
    'nombre del cargo',
    'cargo especifico',
    'titulo del puesto',
  ],
  biography: ['biography', 'bio', 'biografia', 'semblanza', 'descripcion'],
  affiliationId: [
    'affiliationid',
    'affiliation',
    'institucion',
    'afiliacion',
    'afiliacion institucional',
    'organizacion',
    'institution',
    'nombre de la organizacion',
  ],
  country: ['country', 'pais', 'país'],
  region: ['region', 'estado', 'provincia', 'departamento', 'ciudad', 'city'],
  interestIds: [
    'interestids',
    'interests',
    'intereses',
    'intereses de investigacion',
    'temas de interes',
    'interes tecnico',
    'areas de innovacion frugal',
  ],
  generalAreaIds: [
    'generalareaids',
    'areas',
    'area general',
    'areas generales',
    'disciplina',
    'general areas',
  ],
  languages: ['languages', 'idiomas', 'lenguas', 'idioma'],
  socialUrl: ['socialurl', 'social', 'linkedin', 'perfil', 'sitio web', 'website', 'url'],
  consentToPublish: [
    'consenttopublish',
    'consent',
    'consentimiento',
    'consentimiento publicacion',
    'autorizo',
    'autorizacion',
    'acepta publicar',
    'publicar perfil',
  ],
} as const satisfies Record<string, readonly string[]>

export type ImportField = keyof typeof ALIASES

/** Reverse index built once: normalised header spelling -> field name. */
const HEADER_INDEX: ReadonlyMap<string, ImportField> = new Map(
  (Object.keys(ALIASES) as ImportField[]).flatMap((field) =>
    ALIASES[field].map((alias) => [key(alias), field] as const),
  ),
)

function fieldForHeader(header: string): ImportField | undefined {
  const normalised = key(header)
  const direct = HEADER_INDEX.get(normalised)
  if (direct) return direct
  /*
   * Google Forms often appends help text to a question, so headers arrive as
   * "Idiomas (selecciona todos los que apliquen)". A prefix match on the known
   * spellings catches those without matching on a single shared word.
   *
   * The LONGEST matching alias wins, not the first one registered. Several
   * aliases are prefixes of others — "nombre" (fullName) leads "nombre de la
   * organizacion" (affiliation) — and returning the first match filed a real
   * question, "Nombre de la organización:", under the name field. It was then
   * overwritten by the name question and the institution vanished with nothing
   * in `unresolved` to show for it, which is precisely the silent loss this
   * module exists to prevent.
   */
  let best: ImportField | undefined
  let bestLength = 0
  for (const [alias, field] of HEADER_INDEX) {
    if (alias.length > bestLength && normalised.startsWith(alias)) {
      best = field
      bestLength = alias.length
    }
  }
  return best
}

/** Labelled option lists, matched on id or on any of the three translations. */
interface Labelled {
  id: string
  es: string
  en: string
  pt: string
}

function resolveOne(value: string, options: readonly Labelled[]): string | null {
  const target = key(value)
  if (!target) return null
  const hit = options.find(
    (option) =>
      key(option.id) === target ||
      key(option.es) === target ||
      key(option.en) === target ||
      key(option.pt) === target,
  )
  return hit ? hit.id : null
}

/**
 * Splits a multi-select answer and resolves each part.
 *
 * A Forms checkbox question exports every ticked option into one cell joined by
 * ", ", so the separator has to be inferred. Semicolons are accepted too
 * because some locales export that way.
 */
function resolveMany(
  value: string,
  options: readonly Labelled[],
): { ids: string[]; unresolved: string[] } {
  const parts = value
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)

  const ids: string[] = []
  const unresolved: string[] = []
  for (const part of parts) {
    const id = resolveOne(part, options)
    if (id && !ids.includes(id)) ids.push(id)
    else if (!id) unresolved.push(part)
  }
  return { ids, unresolved }
}

/** Affirmative answers, across the three site languages plus raw booleans. */
const AFFIRMATIVE = new Set([
  'true',
  '1',
  'yes',
  'y',
  'si',
  'sim',
  'x',
  'acepto',
  'autorizo',
  'de acuerdo',
  'si, acepto',
  'yes, i agree',
])

function resolveConsent(value: string): boolean {
  return AFFIRMATIVE.has(key(value))
}

/**
 * Resolves an institution, which unlike the other vocabularies has one long
 * official name rather than three translations — "ITESO, Universidad Jesuita de
 * Guadalajara" where a form will almost certainly say "ITESO".
 *
 * So a containment match is allowed, but ONLY when it is unambiguous. Two
 * distinct members of the network are both named "Universidad Centroamericana"
 * (in El Salvador and in Nicaragua); picking either would attribute a person to
 * the wrong country's institution. An ambiguous value is therefore returned as
 * unresolved for a human to settle, which is the entire reason unresolved values
 * are reported instead of swallowed.
 */
function resolveInstitution(value: string): { id: string | null; ambiguous: boolean } {
  const target = key(value)
  if (!target) return { id: null, ambiguous: false }

  const exact = institutions.find(
    (entry) => key(entry.id) === target || key(entry.name) === target,
  )
  if (exact) return { id: exact.id, ambiguous: false }

  const partial = institutions.filter((entry) => key(entry.name).includes(target))
  if (partial.length === 1) return { id: partial[0].id, ambiguous: false }
  return { id: null, ambiguous: partial.length > 1 }
}

/** Positions carry localized descriptors rather than a labelled option list. */
function resolvePosition(value: string): string | null {
  const target = key(value)
  if (!target) return null
  const direct = positionTypes.find((type) => key(type) === target)
  if (direct) return direct
  const labelled = positionTypes.find((type) => {
    const title = positionTitles[type]
    return key(title.es) === target || key(title.en) === target || key(title.pt) === target
  })
  return labelled ?? null
}

/**
 * Resolves a country and its region, tolerating a city in the region column.
 *
 * The form may reasonably ask for a city rather than a state, and the intake
 * validator only accepts a region that belongs to the stated country — so a city
 * is translated through the same lookup table the seed data uses.
 */
function resolveLocation(
  countryValue: string,
  regionValue: string,
): { country: string; region: string; unresolved: string[] } {
  const countryKey = key(countryValue)
  const country = countries.find((entry) => key(entry.name) === countryKey)
  if (!country) {
    return { country: countryValue.trim(), region: regionValue.trim(), unresolved: [] }
  }

  const regionKey = key(regionValue)
  const exact = country.regions.find((region) => key(region) === regionKey)
  if (exact) return { country: country.name, region: exact, unresolved: [] }

  const viaCity = cityToRegion[regionValue.trim()]
  if (viaCity && country.regions.includes(viaCity)) {
    return { country: country.name, region: viaCity, unresolved: [] }
  }

  return { country: country.name, region: regionValue.trim(), unresolved: [] }
}

/** Maps one keyed record onto the intake shape, resolving every vocabulary. */
export function rowToSubmission(record: Record<string, string>): {
  submission: Record<string, unknown>
  unresolved: string[]
} {
  const unresolved: string[] = []
  const read = (field: ImportField): string => (record[field] ?? '').trim()

  const interests = resolveMany(read('interestIds'), researchInterests)
  const areas = resolveMany(read('generalAreaIds'), generalAreas)
  const languages = resolveMany(read('languages'), languageOptions)
  unresolved.push(...interests.unresolved, ...areas.unresolved, ...languages.unresolved)

  const affiliationRaw = read('affiliationId')
  const affiliation = affiliationRaw
    ? resolveInstitution(affiliationRaw)
    : { id: null, ambiguous: false }
  const affiliationId = affiliation.id
  // An unknown or ambiguous institution is recorded rather than dropped:
  // independent members legitimately have none, but a misspelled or ambiguous
  // university must not silently become one of those.
  if (affiliationRaw && !affiliationId) unresolved.push(affiliationRaw)

  const positionRaw = read('position')
  const position = resolvePosition(positionRaw)
  if (positionRaw && !position) unresolved.push(positionRaw)

  const location = resolveLocation(read('country'), read('region'))

  return {
    submission: {
      fullName: read('fullName'),
      email: read('email'),
      position: position ?? '',
      jobPositionName: read('jobPositionName'),
      biography: read('biography'),
      affiliationId,
      country: location.country,
      region: location.region,
      interestIds: interests.ids,
      generalAreaIds: areas.ids,
      languages: languages.ids,
      socialUrl: read('socialUrl'),
      consentToPublish: resolveConsent(read('consentToPublish')),
    },
    unresolved,
  }
}

/**
 * Maps one raw Google Form response — question title to answer, exactly as the
 * form emits it — onto a validated member.
 *
 * This is the entry point the Apps Script transport uses. The script posts the
 * response verbatim and performs no mapping of its own, which is deliberate: the
 * controlled vocabularies live in src/data/onboardingOptions.ts, are generated
 * into firestore.rules, and are guarded by a drift test. A second copy inside a
 * Google-hosted script is a copy nothing checks, and it would silently start
 * rejecting rows the day a country is added here.
 *
 * Question titles are matched with the same alias table the file reader uses, so
 * a reworded question degrades to an ignored field rather than a broken import.
 */
export function mapFormResponse(raw: Record<string, string>, row = 1): ImportRow {
  const record: Record<string, string> = {}
  const ignored: string[] = []

  for (const [question, answer] of Object.entries(raw)) {
    const field = fieldForHeader(question)
    if (field) record[field] = typeof answer === 'string' ? answer : String(answer ?? '')
    else ignored.push(question)
  }

  if (Object.keys(record).length === 0) {
    return { row, ok: false, error: 'no-recognised-columns', unresolved: [] }
  }

  const { submission, unresolved } = rowToSubmission(record)
  const validation = validateIntake(submission)

  return validation.ok && validation.member
    ? { row, ok: true, member: validation.member, unresolved }
    : { row, ok: false, error: validation.error ?? 'missing-required', unresolved }
}

/**
 * Reads a whole export into per-row outcomes.
 *
 * Every row is reported, valid or not, with the reason it failed. A silent drop
 * would mean a member who filled in the form, was vetted, was told they would
 * appear, and then did not — with nobody able to say why.
 */
export function importMembersFromCsv(text: string): ImportResult {
  const table = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''))
  if (table.length === 0) {
    return { headers: [], ignoredHeaders: [], rows: [] }
  }

  const [headerRow, ...dataRows] = table
  const mapping = headerRow.map(fieldForHeader)
  const ignoredHeaders = headerRow.filter((_, index) => mapping[index] === undefined)

  const rows: ImportRow[] = dataRows.map((cells, index) => {
    const row = index + 1

    if (mapping.every((field) => field === undefined)) {
      return { row, ok: false, error: 'no-recognised-columns', unresolved: [] }
    }

    const record: Record<string, string> = {}
    mapping.forEach((field, column) => {
      if (field) record[field] = cells[column] ?? ''
    })

    const { submission, unresolved } = rowToSubmission(record)
    const validation = validateIntake(submission)

    return validation.ok && validation.member
      ? { row, ok: true, member: validation.member, unresolved }
      : { row, ok: false, error: validation.error ?? 'missing-required', unresolved }
  })

  return { headers: headerRow, ignoredHeaders, rows }
}
