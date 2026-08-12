/**
 * Validation for a member record an admin types by hand — the manual add and
 * edit paths in the panel, as opposed to the form pipeline.
 *
 * A published profile and an intake submission are almost the same shape, but not
 * quite: an application must carry a reply address and a consent tick, and a
 * directory record deliberately carries neither. `members` has no email field at
 * all, because it is world-readable.
 *
 * So rather than reimplement a dozen whitelist checks — which would drift from
 * src/domain/intake.ts the moment a country is added — this delegates to the
 * canonical validator and supplies the two fields it requires that a directory
 * record has no concept of, then drops them from the result. One implementation
 * of every rule, and the manual path cannot be laxer than the public form.
 *
 * The placeholder address never escapes this function: the return type omits it,
 * and `validMember` in firestore.rules refuses an `email` key on a published
 * record outright, so a regression here fails closed at the database.
 */
import { validateIntake, type IntakeErrorCode } from './intake'
import type { Member } from '../data/members'

/** The editable surface of a profile. Derived fields are never accepted. */
export interface MemberDraft {
  firstName: string
  lastName: string
  position: string
  jobPositionName: string
  biography: string
  affiliationId: string | null
  country: string
  region: string
  interestIds: string[]
  generalAreaIds: string[]
  languages: string[]
  socialUrl: string
}

export interface MemberDraftValidation {
  ok: boolean
  error?: IntakeErrorCode
  /** Ready to write to `members`, minus the id and the publication stamp. */
  member?: Omit<Member, 'id' | 'publishedAt'>
}

/**
 * Stand-ins for the two fields the intake validator demands.
 *
 * Consent is true because an admin adding a profile by hand is asserting that
 * the person agreed — the same assertion the incorporation form records. That is
 * a real responsibility and the panel says so at the point of use.
 */
const DRAFT_EMAIL = 'draft@relif.invalid'

export function validateMemberDraft(draft: Partial<MemberDraft>): MemberDraftValidation {
  const validation = validateIntake({
    ...draft,
    email: DRAFT_EMAIL,
    consentToPublish: true,
  })

  if (!validation.ok || !validation.member) {
    return { ok: false, error: validation.error }
  }

  // Drop the placeholder rather than spreading the validated record wholesale.
  // Written as an explicit pick for the same reason toPublishedMember is: adding
  // a field to the published shape should be a deliberate act, not a default.
  const { email: _placeholder, ...member } = validation.member
  return { ok: true, member }
}

/** Turns a stored profile back into an editable draft for the edit form. */
export function toDraft(member: Omit<Member, 'id'>): MemberDraft {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    position: member.position,
    jobPositionName: member.jobPositionName,
    biography: member.biography,
    affiliationId: member.affiliationId,
    country: member.country,
    region: member.region,
    interestIds: member.interestIds,
    generalAreaIds: member.generalAreaIds,
    languages: member.languages,
    socialUrl: member.socialUrl ?? '',
  }
}
