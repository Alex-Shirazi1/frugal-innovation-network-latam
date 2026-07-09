/**
 * Server-side intake validation. Mirrors the frontend form rules exactly —
 * the frontend copy is UX; this is the enforcement boundary.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'data')
const readJson = (name) => JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'))

const { countries, positionTypes, researchInterests } = readJson('onboarding-options')
const institutions = readJson('institutions')

const knownInterestIds = new Set(researchInterests.map((i) => i.id))
const knownInstitutionIds = new Set(institutions.map((i) => i.id))

// Localized titles — keep in lockstep with src/api/adapters/bundled.ts
const positionTitles = {
  staff: { es: 'Personal administrativo', en: 'Administrative staff', pt: 'Equipe administrativa' },
  faculty: { es: 'Docente', en: 'Faculty', pt: 'Docente' },
  researcher: { es: 'Investigador/a', en: 'Researcher', pt: 'Pesquisador/a' },
  administrator: { es: 'Directivo/a', en: 'Administrator', pt: 'Gestor/a' },
  independent: { es: 'Miembro independiente', en: 'Independent member', pt: 'Membro independente' },
}

const MAX_NAME_LENGTH = 120
const MAX_URL_LENGTH = 300

function isValidUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function avatarHueFor(fullName) {
  return Math.abs([...fullName].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 360
}

/**
 * Validates a raw intake payload.
 * Returns { ok: true, member } with a normalized record ready for insertion,
 * or { ok: false, error } with a stable error code the frontend can map to copy.
 */
export function validateIntake(body) {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'missing-required' }
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  if (!fullName || fullName.length > MAX_NAME_LENGTH || !positionTypes.includes(body.position)) {
    return { ok: false, error: 'missing-required' }
  }

  const country = countries.find((c) => c.name === body.country)
  if (!country || !country.regions.includes(body.region)) {
    return { ok: false, error: 'invalid-location' }
  }

  const affiliationId =
    typeof body.affiliationId === 'string' && body.affiliationId !== '' ? body.affiliationId : null
  if (affiliationId !== null && !knownInstitutionIds.has(affiliationId)) {
    return { ok: false, error: 'invalid-affiliation' }
  }

  const interestIds = Array.isArray(body.interestIds)
    ? [...new Set(body.interestIds.filter((id) => knownInterestIds.has(id)))]
    : []
  if (interestIds.length === 0) {
    return { ok: false, error: 'missing-interests' }
  }

  const socialUrl = typeof body.socialUrl === 'string' ? body.socialUrl.trim() : ''
  if (socialUrl && (socialUrl.length > MAX_URL_LENGTH || !isValidUrl(socialUrl))) {
    return { ok: false, error: 'invalid-url' }
  }

  const cvFileName =
    typeof body.cvFileName === 'string' && body.cvFileName ? body.cvFileName.slice(0, 200) : null

  return {
    ok: true,
    member: {
      fullName,
      title: positionTitles[body.position],
      position: body.position,
      affiliationId,
      country: body.country,
      region: body.region,
      interestIds,
      socialUrl: socialUrl || null,
      cvFileName,
      avatarHue: avatarHueFor(fullName),
    },
  }
}
