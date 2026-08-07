/**
 * Firestore adapter — the production data source.
 *
 * Scope is deliberately narrow: Firestore holds only what is user-generated
 * (members and their pending submissions). Site content — institutions,
 * resources, conference, onboarding options — stays in the repo and is served
 * from the bundle, because it is versioned, reviewed, and changes via a deploy
 * rather than at runtime. That also keeps document reads near zero, which
 * matters on the free tier.
 *
 * Two collections, mirroring the Express prototype:
 *   submissions/  write-only for the public, readable only by a moderator
 *   members/      world-readable, contains approved records only
 *
 * Approval copies a document across (see adminApi). Reads and writes from the
 * browser stay on this path — firestore.rules is the security boundary.
 *
 * There are still no Cloud Functions in this design: Functions requires the
 * Blaze plan and a billing account, and the site has to keep running without
 * one. The email the network gets on each submission therefore goes out from
 * the browser through a form-to-email relay — see lib/notifyNewMember.ts for
 * why that is safe with a public key.
 */
import { validateIntake } from '../../domain/intake'
import { getDb, type FirebaseConfig } from '../../lib/firebase'
import { bundledDataSource } from './bundled'
import type { RelifDataSource } from '../dataSource'
import type { IntakeResult, IntakeSubmission, Member } from '../types'

export const SUBMISSIONS = 'submissions'
export const MEMBERS = 'members'

/** Only these keys may reach Firestore; the rules reject anything else. */
function toSubmissionDocument(submission: IntakeSubmission, createdAt: string) {
  return {
    firstName: submission.firstName.trim(),
    lastName: submission.lastName.trim(),
    // Lives on the submission only. `submissions` is admin-readable; `members`,
    // which is world-readable, never receives this field.
    email: submission.email.trim().toLowerCase(),
    position: submission.position,
    jobPositionName: submission.jobPositionName.trim(),
    biography: submission.biography.trim(),
    affiliationId: submission.affiliationId,
    country: submission.country,
    region: submission.region,
    interestIds: submission.interestIds,
    generalAreaIds: submission.generalAreaIds,
    languages: submission.languages,
    socialUrl: submission.socialUrl.trim() || null,
    consentToPublish: submission.consentToPublish,
    status: 'pending' as const,
    createdAt,
  }
}

export function createFirestoreDataSource(config: FirebaseConfig): RelifDataSource {
  return {
    // Site content is code-managed; serve it from the bundle.
    getInstitutions: bundledDataSource.getInstitutions,
    getResources: bundledDataSource.getResources,
    getConference: bundledDataSource.getConference,
    getOnboardingOptions: bundledDataSource.getOnboardingOptions,

    async getMembers(): Promise<Member[]> {
      const db = await getDb(config)
      const { collection, getDocs } = await import('firebase/firestore')
      const snapshot = await getDocs(collection(db, MEMBERS))
      const approved = snapshot.docs.map((d) => ({ ...(d.data() as Omit<Member, 'id'>), id: d.id }))

      // Seed profiles are mock data that lives in the repo, so the published
      // directory is approved Firestore records plus the bundled snapshot —
      // same composition the Express backend returns.
      const seed = await bundledDataSource.getMembers()
      return [...approved, ...seed]
    },

    async submitIntake(submission: IntakeSubmission): Promise<IntakeResult> {
      // Validate with the canonical validator first. The rules enforce the same
      // constraints server-side, but failing here yields a specific error code
      // instead of Firestore's opaque permission-denied.
      const validation = validateIntake(submission)
      if (!validation.ok || !validation.member) {
        return { success: false, error: validation.error ?? 'missing-required', persisted: false }
      }

      const db = await getDb(config)
      const { addDoc, collection } = await import('firebase/firestore')
      const createdAt = new Date().toISOString()
      const ref = await addDoc(
        collection(db, SUBMISSIONS),
        toSubmissionDocument(submission, createdAt),
      )

      // Durably stored and awaiting moderation. The record returned here is the
      // locally derived one — the submitter cannot see the queue.
      return {
        success: true,
        data: { ...validation.member, id: ref.id },
        persisted: true,
      }
    },
  }
}
