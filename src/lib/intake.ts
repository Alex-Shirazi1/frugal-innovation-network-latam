import type { Member } from '../data/members'
import { countries, researchInterests, type PositionType } from '../data/onboardingOptions'

export interface IntakeSubmission {
  fullName: string
  position: PositionType | ''
  affiliationId: string | null
  country: string
  region: string
  interestIds: string[]
  socialUrl: string
  cvFileName: string | null
}

export interface IntakeResult {
  success: boolean
  data?: Member
  error?: string
}

const SIMULATED_LATENCY_MS = 700

const positionTitles: Record<PositionType, string> = {
  staff: 'Personal administrativo',
  faculty: 'Docente',
  researcher: 'Investigador/a',
  administrator: 'Directivo/a',
  independent: 'Miembro independiente',
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Mock intake API: validates a submission server-side-style and maps it into
 * a directory Member record. In production this becomes a POST to the intake
 * endpoint; the response shape (ApiResponse envelope) stays identical.
 * NOTE: nothing here ever talks to the live redinnovacionfrugal.lat backend.
 */
export async function processIntake(submission: IntakeSubmission): Promise<IntakeResult> {
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
    avatarHue: Math.abs(
      [...submission.fullName].reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    ) % 360,
  }

  return { success: true, data: member }
}
