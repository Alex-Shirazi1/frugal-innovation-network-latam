/**
 * Bundled adapter: serves the data compiled into the app. Keeps the whole
 * site fully functional with no backend (static hosting, offline dev) and
 * acts as the automatic fallback when the HTTP source is unreachable.
 * Intake submissions are validated locally and only live in page state.
 */
import { mockMembers } from '../../data/members'
import { institutions } from '../../data/institutions'
import { resources } from '../../data/resources'
import {
  agendaDay1,
  agendaDay2,
  conferenceVideos,
  galleryTiles,
  speakers,
} from '../../data/conference'
import { countries, positionTypes, researchInterests } from '../../data/onboardingOptions'
import type { RelifDataSource } from '../dataSource'
import type { IntakeResult, IntakeSubmission, Localized, Member, PositionType } from '../types'

const SIMULATED_LATENCY_MS = 400

const positionTitles: Record<PositionType, Localized> = {
  staff: { es: 'Personal administrativo', en: 'Administrative staff', pt: 'Equipe administrativa' },
  faculty: { es: 'Docente', en: 'Faculty', pt: 'Docente' },
  researcher: { es: 'Investigador/a', en: 'Researcher', pt: 'Pesquisador/a' },
  administrator: { es: 'Directivo/a', en: 'Administrator', pt: 'Gestor/a' },
  independent: { es: 'Miembro independiente', en: 'Independent member', pt: 'Membro independente' },
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Same rules as the server's validate.mjs — keep the two in lockstep. */
export async function processIntakeLocally(submission: IntakeSubmission): Promise<IntakeResult> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS))

  if (!submission.fullName.trim() || !submission.position) {
    return { success: false, error: 'missing-required' }
  }

  const country = countries.find((c) => c.name === submission.country)
  if (!country || !country.regions.includes(submission.region)) {
    return { success: false, error: 'invalid-location' }
  }

  const knownInterestIds = new Set(researchInterests.map((i) => i.id))
  const interestIds = submission.interestIds.filter((id) => knownInterestIds.has(id))
  if (interestIds.length === 0) {
    return { success: false, error: 'missing-interests' }
  }

  if (submission.socialUrl && !isValidUrl(submission.socialUrl)) {
    return { success: false, error: 'invalid-url' }
  }

  const member: Member = {
    id: `intake-${Date.now()}`,
    fullName: submission.fullName.trim(),
    title: positionTitles[submission.position],
    position: submission.position,
    affiliationId: submission.affiliationId,
    country: submission.country,
    region: submission.region,
    interestIds,
    socialUrl: submission.socialUrl || undefined,
    avatarHue:
      Math.abs([...submission.fullName].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 360,
  }

  return { success: true, data: member }
}

export const bundledDataSource: RelifDataSource = {
  getInstitutions: async () => institutions,
  getMembers: async () => mockMembers,
  getResources: async () => resources,
  getConference: async () => ({ agendaDay1, agendaDay2, speakers, conferenceVideos, galleryTiles }),
  getOnboardingOptions: async () => ({ countries, positionTypes, researchInterests }),
  submitIntake: processIntakeLocally,
}
