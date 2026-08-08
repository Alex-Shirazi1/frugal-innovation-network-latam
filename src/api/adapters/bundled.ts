/**
 * Bundled adapter: serves the data compiled into the app. Keeps the whole
 * site fully functional with no backend (static hosting, offline dev) and
 * acts as the automatic fallback when the primary source is unreachable.
 *
 * IMPORTANT: submissions handled here are NOT persisted anywhere — they only
 * live in page state. `persisted: false` on the result tells the UI to say so
 * instead of showing a success screen for data that went nowhere.
 */
import { mockMembers } from '../../data/members'
import { institutions } from '../../data/institutions'
import { resources } from '../../data/resources'
import { initiatives } from '../../data/initiatives'
import { bibliography } from '../../data/bibliography'
import { congress } from '../../data/congress'
import { annualMeetingVideos, speakers } from '../../data/conference'
import {
  countries,
  generalAreas,
  languageOptions,
  positionTypes,
  researchInterests,
} from '../../data/onboardingOptions'
import { validateIntake } from '../../domain/intake'
import type { RelifDataSource } from '../dataSource'
import type { IntakeResult, IntakeSubmission, Member } from '../types'

const SIMULATED_LATENCY_MS = 400

/**
 * Validates locally using the same canonical validator the backend runs, so
 * the offline experience matches the hosted one. The returned record exists
 * for optimistic display only — nothing is stored.
 */
export async function processIntakeLocally(submission: IntakeSubmission): Promise<IntakeResult> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS))

  const result = validateIntake(submission)
  if (!result.ok || !result.member) {
    return { success: false, error: result.error ?? 'missing-required', persisted: false }
  }

  const member: Member = { ...result.member, id: `local-${Date.now()}` }
  return { success: true, data: member, persisted: false }
}

export const bundledDataSource: RelifDataSource = {
  getInstitutions: async () => institutions,
  getInitiatives: async () => initiatives,
  getBibliography: async () => bibliography,
  getCongress: async () => congress,
  getMembers: async () => mockMembers,
  getResources: async () => resources,
  getConference: async () => ({ speakers, annualMeetingVideos }),
  getOnboardingOptions: async () => ({
    countries,
    positionTypes,
    researchInterests,
    generalAreas,
    languageOptions,
  }),
  submitIntake: processIntakeLocally,
}
