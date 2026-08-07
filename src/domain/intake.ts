/**
 * THE canonical intake validator.
 *
 * Previously this logic existed twice — server/validate.mjs and the bundled
 * adapter — with a "keep the two in lockstep" comment holding it together.
 * Both now call this module, so there is exactly one definition of what a
 * valid submission is. The Firestore rules cannot import TypeScript, so they
 * are *generated* from the same option data (scripts/generate-firestore-rules).
 *
 * Everything here is pure and dependency-free so it runs unchanged in the
 * browser, in Node, and in tests.
 */
import {
  countries,
  fieldLimits,
  generalAreas,
  languageOptions,
  positionTypes,
  researchInterests,
  type PositionType,
} from '../data/onboardingOptions'
import { institutions } from '../data/institutions'
import type { Member } from '../data/members'
import type { Localized } from '../data/conference'

/** Raw shape submitted by the onboarding form. */
export interface IntakeSubmission {
  firstName: string
  lastName: string
  /**
   * How the network replies. This is the whole point of the form — Allan's
   * first move on any application is to email the person to arrange a
   * conversation — so it is required, unlike every other contact field.
   *
   * Never published. It rides on the submission and stops there; `Member`, the
   * shape the world-readable directory renders, has no email field at all.
   */
  email: string
  position: PositionType | ''
  jobPositionName: string
  biography: string
  affiliationId: string | null
  country: string
  region: string
  interestIds: string[]
  generalAreaIds: string[]
  languages: string[]
  socialUrl: string
  /** Must be true — the member is consenting to public publication. */
  consentToPublish: boolean
}

export type IntakeErrorCode =
  | 'missing-required'
  | 'invalid-email'
  | 'invalid-location'
  | 'invalid-affiliation'
  | 'missing-interests'
  | 'missing-areas'
  | 'missing-languages'
  | 'invalid-url'
  | 'too-long'
  | 'consent-required'
  | 'rate-limited'
  | 'network'

/**
 * Fields the server derives. A client can never set these.
 *
 * `email` is added on top of `Member` rather than being part of it: `Member` is
 * what the public directory renders and what the world-readable `members`
 * collection holds, so an email on that type would be an email on the open web.
 * Carrying it here keeps it available to the moderation queue and the
 * notification while making its exclusion from the published record structural
 * rather than something a future edit has to remember.
 */
export type ValidatedIntake = Omit<Member, 'id' | 'avatarHue'> & {
  avatarHue: number
  email: string
}

export interface IntakeValidation {
  ok: boolean
  error?: IntakeErrorCode
  member?: ValidatedIntake
}

/** Curated localized descriptors, derived from position — never user-authored. */
export const positionTitles: Record<PositionType, Localized> = {
  staff: { es: 'Personal administrativo', en: 'Administrative staff', pt: 'Equipe administrativa' },
  faculty: { es: 'Docente', en: 'Faculty', pt: 'Docente' },
  researcher: { es: 'Investigador/a', en: 'Researcher', pt: 'Pesquisador/a' },
  administrator: { es: 'Directivo/a', en: 'Administrator', pt: 'Gestor/a' },
  independent: { es: 'Miembro independiente', en: 'Independent member', pt: 'Membro independente' },
}

const knownInterestIds = new Set(researchInterests.map((i) => i.id))
const knownAreaIds = new Set(generalAreas.map((a) => a.id))
const knownLanguageIds = new Set(languageOptions.map((l) => l.id))
const knownAffiliationIds = new Set(institutions.map((i) => i.id))

/**
 * Deliberately permissive: one @, something either side, a dot in the domain,
 * no whitespace. Stricter patterns reject addresses that are actually valid
 * (plus-tags, new TLDs, unicode locals) and the only real proof an address
 * works is mail arriving at it. This exists to catch typos and empty strings,
 * not to adjudicate RFC 5322.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Stable hue so a member's avatar colour never changes between renders. */
export function avatarHueFor(name: string): number {
  return Math.abs([...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 360
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function whitelist(value: unknown, known: Set<string>, max: number): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))].slice(
    0,
    max,
  )
}

/**
 * Validates an untrusted payload and returns a normalized member record.
 * Never throws — callers branch on `ok`.
 */
export function validateIntake(body: unknown): IntakeValidation {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'missing-required' }
  }
  const raw = body as Record<string, unknown>

  const firstName = asString(raw.firstName)
  const lastName = asString(raw.lastName)
  const position = raw.position
  if (!firstName || !lastName || typeof position !== 'string' || !positionTypes.includes(position as PositionType)) {
    return { ok: false, error: 'missing-required' }
  }
  if (firstName.length > fieldLimits.firstName || lastName.length > fieldLimits.lastName) {
    return { ok: false, error: 'too-long' }
  }

  // Checked before the location and taxonomy work below so a submission with no
  // reply address fails on that, rather than on whichever field happens to be
  // validated first.
  const email = asString(raw.email).toLowerCase()
  if (!email) return { ok: false, error: 'missing-required' }
  if (email.length > fieldLimits.email || !isValidEmail(email)) {
    return { ok: false, error: 'invalid-email' }
  }

  // Consent is checked before anything is normalized, so a non-consenting
  // payload never produces a storable record even by accident.
  if (raw.consentToPublish !== true) {
    return { ok: false, error: 'consent-required' }
  }

  const country = countries.find((c) => c.name === raw.country)
  if (!country || typeof raw.region !== 'string' || !country.regions.includes(raw.region)) {
    return { ok: false, error: 'invalid-location' }
  }

  const affiliationId = typeof raw.affiliationId === 'string' && raw.affiliationId ? raw.affiliationId : null
  if (affiliationId !== null && !knownAffiliationIds.has(affiliationId)) {
    return { ok: false, error: 'invalid-affiliation' }
  }

  const interestIds = whitelist(raw.interestIds, knownInterestIds, fieldLimits.maxTechnicalInterests)
  if (interestIds.length === 0) return { ok: false, error: 'missing-interests' }

  const generalAreaIds = whitelist(raw.generalAreaIds, knownAreaIds, fieldLimits.maxGeneralAreas)
  if (generalAreaIds.length === 0) return { ok: false, error: 'missing-areas' }

  const languages = whitelist(raw.languages, knownLanguageIds, fieldLimits.maxLanguages)
  if (languages.length === 0) return { ok: false, error: 'missing-languages' }

  const jobPositionName = asString(raw.jobPositionName)
  const biography = asString(raw.biography)
  if (
    jobPositionName.length > fieldLimits.jobPositionName ||
    biography.length > fieldLimits.biography
  ) {
    return { ok: false, error: 'too-long' }
  }

  const socialUrl = asString(raw.socialUrl)
  if (socialUrl && (socialUrl.length > fieldLimits.socialUrl || !isValidUrl(socialUrl))) {
    return { ok: false, error: 'invalid-url' }
  }

  const fullName = `${firstName} ${lastName}`
  return {
    ok: true,
    member: {
      firstName,
      lastName,
      email,
      fullName,
      title: positionTitles[position as PositionType],
      position: position as PositionType,
      jobPositionName,
      biography,
      affiliationId,
      country: country.name,
      region: raw.region,
      interestIds,
      generalAreaIds,
      languages,
      socialUrl: socialUrl || undefined,
      avatarHue: avatarHueFor(fullName),
    },
  }
}
