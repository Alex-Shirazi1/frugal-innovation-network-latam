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
 * Collections:
 *   submissions/   write-only for the public, readable only by a moderator
 *   members/       world-readable, contains approved records only
 *   initiatives/   world-readable, moderator-writable — the Iniciativas cards
 *   bibliography/  world-readable, moderator-writable — the reading list
 *   resources/     world-readable, moderator-writable — the documents table
 *   siteContent/   world-readable, moderator-writable — one-off blocks such as
 *                  the congress card
 *
 * The last two are content the network edits at runtime, which is why they are
 * here rather than in the repo like the rest of the site copy. Both fall back
 * to the bundled seed when their collection is empty, so an unpopulated project
 * renders the same site it always did rather than two blank sections.
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
import type { Initiative } from '../../data/initiatives'
import type { Resource } from '../../data/resources'
import type { Congress } from '../../data/congress'
import type { BibliographyEntry } from '../../data/bibliography'

export const SUBMISSIONS = 'submissions'
export const MEMBERS = 'members'
export const INITIATIVES = 'initiatives'
export const BIBLIOGRAPHY = 'bibliography'
export const RESOURCES = 'resources'
export const SITE_CONTENT = 'siteContent'
/** Document id of the congress block inside `siteContent`. */
export const CONGRESS_DOC = 'congress'

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
    getConference: bundledDataSource.getConference,
    getOnboardingOptions: bundledDataSource.getOnboardingOptions,

    /**
     * Empty collection means "not populated yet", not "the network deleted
     * everything" — Firestore cannot distinguish those, and defaulting to the
     * seed is the recoverable direction to be wrong in. Deleting every card
     * from the admin panel restores the seed rather than blanking the section;
     * that is a deliberate trade, documented here because it will surprise
     * someone eventually.
     */
    async getInitiatives(): Promise<Initiative[]> {
      const db = await getDb(config)
      const { collection, getDocs, orderBy, query } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, INITIATIVES), orderBy('order')))
      if (snapshot.empty) return bundledDataSource.getInitiatives()
      return snapshot.docs.map((d) => ({ ...(d.data() as Omit<Initiative, 'id'>), id: d.id }))
    },

    async getBibliography(): Promise<BibliographyEntry[]> {
      const db = await getDb(config)
      const { collection, getDocs, orderBy, query } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, BIBLIOGRAPHY), orderBy('paperNumber')))
      if (snapshot.empty) return bundledDataSource.getBibliography()
      return snapshot.docs.map((d) => ({ ...(d.data() as Omit<BibliographyEntry, 'id'>), id: d.id }))
    },

    async getResources(): Promise<Resource[]> {
      const db = await getDb(config)
      const { collection, getDocs, orderBy, query } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, RESOURCES), orderBy('year', 'desc')))
      if (snapshot.empty) return bundledDataSource.getResources()
      return snapshot.docs.map((d) => ({ ...(d.data() as Omit<Resource, 'id'>), id: d.id }))
    },

    async getCongress(): Promise<Congress> {
      const db = await getDb(config)
      const { doc, getDoc } = await import('firebase/firestore')
      const snap = await getDoc(doc(db, SITE_CONTENT, CONGRESS_DOC))
      // A single document rather than a collection: there is one congress card,
      // and modelling it as a collection would invite a second one.
      if (!snap.exists()) return bundledDataSource.getCongress()
      return snap.data() as Congress
    },

    /**
     * The published directory: stored records, or the bundled seed while there
     * are none.
     *
     * A fallback rather than a concatenation, matching every other collection
     * here. The two used to be added together, which meant publishing one real
     * member produced a directory of that person plus 54 fabricated ones — the
     * fake data stayed on the public site until somebody edited the repository.
     * Falling back instead means the first real profile clears the mock
     * directory on its own, and the admin panel's count matches the site's.
     */
    async getMembers(): Promise<Member[]> {
      const db = await getDb(config)
      const { collection, getDocs } = await import('firebase/firestore')
      const snapshot = await getDocs(collection(db, MEMBERS))
      if (snapshot.empty) return bundledDataSource.getMembers()
      return snapshot.docs.map((d) => ({ ...(d.data() as Omit<Member, 'id'>), id: d.id }))
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
