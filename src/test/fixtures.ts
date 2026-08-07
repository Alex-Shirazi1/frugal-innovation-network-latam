/**
 * Shared test fixtures.
 *
 * Member and IntakeSubmission gained several fields at once (first/last name,
 * job position, biography, general areas, languages, consent). Keeping the
 * builders here means the next field addition is one edit, not one per suite.
 */
import type { IntakeSubmission, Member } from '../api/types'

export function makeMember(overrides: Partial<Member> = {}): Member {
  const firstName = overrides.firstName ?? 'Ada'
  const lastName = overrides.lastName ?? 'Lovelace'
  return {
    id: 'm-1',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    title: { es: 'Investigadora', en: 'Researcher', pt: 'Pesquisadora' },
    position: 'researcher',
    jobPositionName: 'Investigadora Asociada',
    biography: 'Trabaja en innovación frugal aplicada a salud comunitaria.',
    affiliationId: null,
    country: 'México',
    region: 'Jalisco',
    interestIds: ['salud'],
    generalAreaIds: ['ingenieria'],
    languages: ['es'],
    avatarHue: 42,
    ...overrides,
  }
}

export function makeSubmission(overrides: Partial<IntakeSubmission> = {}): IntakeSubmission {
  return {
    firstName: 'Ana',
    lastName: 'Prueba García',
    email: 'ana.prueba@example.org',
    position: 'researcher',
    jobPositionName: 'Investigadora Asociada',
    biography: 'Trabaja en salud comunitaria y energía asequible.',
    affiliationId: 'iteso',
    country: 'México',
    region: 'Jalisco',
    interestIds: ['salud', 'energia'],
    generalAreaIds: ['ingenieria'],
    languages: ['es', 'en'],
    socialUrl: 'https://linkedin.com/in/ana-prueba',
    consentToPublish: true,
    ...overrides,
  }
}
