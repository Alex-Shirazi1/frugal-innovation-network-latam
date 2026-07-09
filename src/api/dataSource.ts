import type {
  ConferenceData,
  Institution,
  IntakeResult,
  IntakeSubmission,
  Member,
  OnboardingOptions,
  Resource,
} from './types'

/**
 * The single seam between the UI and wherever data actually lives.
 * Swapping backends (Express prototype today; Supabase, a CMS, or anything
 * else tomorrow) means providing another implementation of this interface —
 * no component changes.
 */
export interface RelifDataSource {
  getInstitutions(): Promise<Institution[]>
  getMembers(): Promise<Member[]>
  getResources(): Promise<Resource[]>
  getConference(): Promise<ConferenceData>
  getOnboardingOptions(): Promise<OnboardingOptions>
  submitIntake(submission: IntakeSubmission): Promise<IntakeResult>
}
