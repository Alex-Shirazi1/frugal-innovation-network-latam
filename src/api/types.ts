/**
 * Shared contract types for the RELIF data layer.
 * Domain types are declared next to their seed data in src/data and
 * re-exported here so the rest of the app has a single import surface.
 */
export type { Member } from '../data/members'
export type { Institution, InstitutionCategory } from '../data/institutions'
export type { Resource, ResourceLang, ResourceType } from '../data/resources'
export type { ConferenceVideo, Localized, Speaker } from '../data/conference'
export type {
  CountryOption,
  LanguageOption,
  PositionType,
  ResearchInterest,
} from '../data/onboardingOptions'

// Validation lives in src/domain/intake.ts — the single source of truth shared
// by the browser, the local Express backend, and the generated Firestore rules.
export type { IntakeSubmission, IntakeErrorCode, ValidatedIntake } from '../domain/intake'

import type { Member } from '../data/members'
import type { ConferenceVideo, Speaker } from '../data/conference'
import type {
  CountryOption,
  LanguageOption,
  PositionType,
  ResearchInterest,
} from '../data/onboardingOptions'
import type { IntakeErrorCode } from '../domain/intake'

/** Envelope returned by every backend endpoint. */
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

export interface ConferenceData {
  speakers: Speaker[]
  annualMeetingVideos: ConferenceVideo[]
}

export interface OnboardingOptions {
  countries: CountryOption[]
  positionTypes: PositionType[]
  researchInterests: ResearchInterest[]
  generalAreas: ResearchInterest[]
  languageOptions: LanguageOption[]
}

export interface IntakeResult {
  success: boolean
  data?: Member
  error?: IntakeErrorCode
  /**
   * True only when a backend durably stored the submission.
   *
   * The bundled fallback can validate a submission perfectly well while
   * storing nothing, so the UI must not treat `success: true` alone as proof
   * the data was saved — otherwise a real signup silently disappears behind a
   * success screen.
   */
  persisted: boolean
}

/** A pending submission as seen by a moderator. */
/**
 * A submission awaiting moderation. Carries `email` on top of `Member` because
 * the queue is where the network picks up the thread — and because `Member`
 * itself must never hold an address: that type is what the world-readable
 * directory renders.
 */
export interface PendingMember extends Member {
  email: string
  status: 'pending' | 'approved'
  createdAt: string
}
