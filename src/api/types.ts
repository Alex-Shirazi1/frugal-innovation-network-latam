/**
 * Shared contract types for the RELIF data layer.
 * Domain types are declared next to their seed data in src/data and
 * re-exported here so the rest of the app has a single import surface.
 */
export type { Member } from '../data/members'
export type { Institution, InstitutionCategory } from '../data/institutions'
export type { Resource, ResourceLang, ResourceType } from '../data/resources'
export type {
  AgendaItem,
  ConferenceVideo,
  GalleryTile,
  Localized,
  Speaker,
} from '../data/conference'
export type { CountryOption, PositionType, ResearchInterest } from '../data/onboardingOptions'

import type { Member } from '../data/members'
import type { AgendaItem, ConferenceVideo, GalleryTile, Speaker } from '../data/conference'
import type { CountryOption, PositionType, ResearchInterest } from '../data/onboardingOptions'

/** Envelope returned by every backend endpoint. */
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

export interface ConferenceData {
  agendaDay1: AgendaItem[]
  agendaDay2: AgendaItem[]
  speakers: Speaker[]
  conferenceVideos: ConferenceVideo[]
  galleryTiles: GalleryTile[]
}

export interface OnboardingOptions {
  countries: CountryOption[]
  positionTypes: PositionType[]
  researchInterests: ResearchInterest[]
}

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

/** Stable error codes shared by the server and the bundled fallback. */
export type IntakeErrorCode =
  | 'missing-required'
  | 'invalid-location'
  | 'invalid-affiliation'
  | 'missing-interests'
  | 'invalid-url'
  | 'rate-limited'
  | 'network'

export interface IntakeResult {
  success: boolean
  data?: Member
  error?: IntakeErrorCode
}
