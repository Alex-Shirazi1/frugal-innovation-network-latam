/**
 * Moderation client.
 *
 * Two backends behind one interface:
 *
 *  - Firestore (hosted): Firebase Auth email and password, plus an `admin`
 *    custom claim, enforced by firestore.rules. A static site cannot hold a
 *    secret, so the shared-key scheme below is NOT usable in production — but
 *    it does not need to be, because Firebase Auth holds the password hash and
 *    checks it for us.
 *  - Express (local dev): the x-admin-key header, which is fine for a process
 *    on localhost reading a secret from the environment.
 *
 * Approval copies the submission into `members` and deletes it from
 * `submissions`. The rules permit exactly that pair for a claim-bearing admin,
 * so no Cloud Function is required — which keeps the project on the free Spark
 * plan, since Functions would force Blaze and a billing account.
 */
import { readFirebaseConfig, getAuthClient, getDb } from '../lib/firebase'
import { validateMemberDraft, type MemberDraft } from '../domain/memberDraft'
import { mapFormResponse, type ImportRow } from '../domain/memberImport'
import { resolveDataSourceKind } from './index'
import { avatarHueFor, positionTitles } from '../domain/intake'
import type { ApiResponse, Member, PendingMember, PositionType } from './types'
import type { Initiative } from '../data/initiatives'
import type { BibliographyEntry } from '../data/bibliography'
import type { Congress } from '../data/congress'
import { bundledDataSource } from './adapters/bundled'

export type AdminBackend = 'firestore' | 'http'

export function adminBackend(): AdminBackend {
  return resolveDataSourceKind() === 'firestore' ? 'firestore' : 'http'
}

export interface AdminSession {
  backend: AdminBackend
  /** Display label for whoever is signed in (email, or "local admin"). */
  label: string
}

/**
 * What the sign-in form collects. One shape for both backends so the gate is a
 * single form rather than one per deployment target — Firestore checks the pair
 * against Firebase Auth, the Express prototype checks the password against its
 * ADMIN_KEY and keeps the address only as a label.
 */
export interface AdminCredentials {
  email: string
  password: string
}

/* ------------------------------------------------------------------ Firestore */

interface SubmissionDocument {
  fullName: string
  /** Contact address for the network. Never published — see toPublishedMember. */
  email: string
  position: PositionType
  jobPositionName: string
  biography: string
  affiliationId: string | null
  country: string
  region: string
  interestIds: string[]
  generalAreaIds: string[]
  languages: string[]
  socialUrl: string | null
  consentToPublish: boolean
  status: 'pending' | 'approved'
  createdAt: string
}

/**
 * Builds the published record from a submission. Display fields are derived
 * here, never taken from the submitter — the same rule the intake validator
 * applies, so an approved record cannot carry a forged identity.
 *
 * Written field by field rather than by spreading the submission, which is what
 * keeps `email` off the public record: `members` is world-readable, so an
 * applicant's address reaching it would put it on the open web. Adding a field
 * here is a deliberate act; a spread would have published it by default.
 */
function toPublishedMember(d: SubmissionDocument): Omit<Member, 'id'> {
  return {
    fullName: d.fullName,
    title: positionTitles[d.position],
    position: d.position,
    jobPositionName: d.jobPositionName,
    biography: d.biography,
    affiliationId: d.affiliationId,
    country: d.country,
    region: d.region,
    interestIds: d.interestIds,
    generalAreaIds: d.generalAreaIds,
    languages: d.languages,
    socialUrl: d.socialUrl ?? undefined,
    avatarHue: avatarHueFor(d.fullName),
  }
}

function requireConfig() {
  const config = readFirebaseConfig()
  if (!config) throw new Error('firebase-not-configured')
  return config
}

const firestoreAdmin = {
  /**
   * Email and password, then verify the claim actually grants moderation.
   *
   * The password is never a value this codebase holds. Firebase Auth stores it
   * hashed and checks it server-side, which is what lets a static site have a
   * password gate at all — there is no secret in the bundle to leak, and the
   * account can be rotated or disabled from the Firebase console without a
   * redeploy.
   *
   * Signing in successfully is still not enough: the claim is the authorisation,
   * and it is what firestore.rules checks. A signed-in account without it is
   * signed straight back out, so a stray session cannot linger with a token the
   * rules will reject anyway.
   */
  async signIn(email: string, password: string): Promise<AdminSession> {
    const config = requireConfig()
    const auth = await getAuthClient(config)
    const { signInWithEmailAndPassword, signOut } = await import('firebase/auth')
    const credential = await signInWithEmailAndPassword(auth, email, password)

    // force-refresh so a freshly granted claim is picked up without re-login.
    const token = await credential.user.getIdTokenResult(true)
    if (token.claims.admin !== true) {
      await signOut(auth)
      throw new Error('unauthorized')
    }
    return { backend: 'firestore', label: credential.user.email ?? 'admin' }
  },

  async restore(): Promise<AdminSession | null> {
    const config = readFirebaseConfig()
    if (!config) return null
    const auth = await getAuthClient(config)
    const { onAuthStateChanged } = await import('firebase/auth')
    // Auth state resolves asynchronously on load; wait for the first emission.
    const user = await new Promise<Awaited<ReturnType<typeof getAuthClient>>['currentUser']>(
      (resolve) => {
        const stop = onAuthStateChanged(auth, (u) => {
          stop()
          resolve(u)
        })
      },
    )
    if (!user) return null
    const token = await user.getIdTokenResult()
    if (token.claims.admin !== true) return null
    return { backend: 'firestore', label: user.email ?? 'admin' }
  },

  async signOut(): Promise<void> {
    const config = readFirebaseConfig()
    if (!config) return
    const auth = await getAuthClient(config)
    const { signOut } = await import('firebase/auth')
    await signOut(auth)
  },

  async listPending(): Promise<PendingMember[]> {
    const db = await getDb(requireConfig())
    const { collection, getDocs, orderBy, query, where } = await import('firebase/firestore')
    const snapshot = await getDocs(
      query(collection(db, 'submissions'), where('status', '==', 'pending'), orderBy('createdAt')),
    )
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as SubmissionDocument
      return {
        ...toPublishedMember(data),
        id: docSnap.id,
        // Added back on top of the published shape, not carried through it: the
        // queue needs a reply address, the directory must never have one.
        email: data.email ?? '',
        status: data.status,
        createdAt: data.createdAt,
      }
    })
  },

  async approve(id: string): Promise<void> {
    const db = await getDb(requireConfig())
    const { deleteDoc, doc, getDoc, setDoc } = await import('firebase/firestore')
    const submissionRef = doc(db, 'submissions', id)
    const snap = await getDoc(submissionRef)
    if (!snap.exists()) throw new Error('not-found')

    // Publish first, then clear the queue entry. If the delete fails the record
    // is live and the entry reappears in the queue — visible and recoverable,
    // which is the safer direction to fail.
    //
    // publishedAt is stamped here rather than inside toPublishedMember, which
    // also builds the pending list — a queue entry carrying a publication date
    // would be claiming something that has not happened.
    await setDoc(doc(db, 'members', id), {
      ...toPublishedMember(snap.data() as SubmissionDocument),
      publishedAt: new Date().toISOString(),
    })
    await deleteDoc(submissionRef)
  },

  async reject(id: string): Promise<void> {
    const db = await getDb(requireConfig())
    const { deleteDoc, doc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'submissions', id))
  },
}

/* ----------------------------------------------------------------- Express dev */

const baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api'
const KEY_STORAGE = 'relif-admin-key'

async function keyedRequest<T>(path: string, adminKey: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
  })
  if (response.status === 401) throw new Error('unauthorized')
  const body = (await response.json()) as ApiResponse<T>
  if (!body.success || body.data === null) throw new Error(body.error ?? 'request-failed')
  return body.data
}

const httpAdmin = {
  /** The password doubles as ADMIN_KEY here; the address is only a label. */
  async signIn({ email, password }: AdminCredentials): Promise<AdminSession> {
    await keyedRequest('/admin/login', password, { method: 'POST' })
    sessionStorage.setItem(KEY_STORAGE, password)
    return { backend: 'http', label: email || 'local admin' }
  },

  async restore(): Promise<AdminSession | null> {
    const key = sessionStorage.getItem(KEY_STORAGE)
    if (!key) return null
    try {
      await keyedRequest('/admin/login', key, { method: 'POST' })
      return { backend: 'http', label: 'local admin' }
    } catch {
      sessionStorage.removeItem(KEY_STORAGE)
      return null
    }
  },

  async signOut(): Promise<void> {
    sessionStorage.removeItem(KEY_STORAGE)
  },

  listPending(): Promise<PendingMember[]> {
    return keyedRequest<PendingMember[]>(
      '/admin/pending',
      sessionStorage.getItem(KEY_STORAGE) ?? '',
    )
  },

  async approve(id: string): Promise<void> {
    await keyedRequest(
      `/admin/members/${encodeURIComponent(id)}/approve`,
      sessionStorage.getItem(KEY_STORAGE) ?? '',
      { method: 'POST' },
    )
  },

  async reject(id: string): Promise<void> {
    await keyedRequest(
      `/admin/members/${encodeURIComponent(id)}/reject`,
      sessionStorage.getItem(KEY_STORAGE) ?? '',
      { method: 'POST' },
    )
  },
}


/* ------------------------------------------------------------ Members admin */

/** A published profile as the panel sees it: the record plus its document id. */
export interface AdminMember extends Member {
  /** Absent on the bundled seed profiles, which were never published. */
  publishedAt?: string
}

/** A form response awaiting a decision, already mapped and validated. */
export interface ArrivedResponse {
  id: string
  receivedAt: string
  /** Question titles to answers, verbatim, for showing what was actually said. */
  answers: Record<string, string>
  outcome: ImportRow
}

/**
 * Directory management: the manual half of the members tab.
 *
 * The automatic half is the incorporation form, and it stays primary — these
 * exist because a directory nobody can correct or remove from is worse than one
 * with a typo in it. Until now the only way to take a profile down was opening
 * the Firebase console, which is not something the network can be asked to do
 * when somebody writes in asking to be removed.
 */
export const membersAdmin = {
  /**
   * Published profiles held in Firestore.
   *
   * Deliberately NOT the same list the public directory renders. That one is
   * these records plus the bundled mock seed concatenated at read time, and the
   * seed lives in the repository — it cannot be edited or deleted from a panel,
   * so listing it here would offer actions that silently do nothing.
   */
  async list(): Promise<AdminMember[]> {
    const db = await getDb(requireConfig())
    const { collection, getDocs } = await import('firebase/firestore')
    const snapshot = await getDocs(collection(db, 'members'))
    return snapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as Omit<Member, 'id'>),
      id: docSnap.id,
    }))
  },

  /** Creates or overwrites a profile from a hand-typed draft. */
  async save(id: string | null, draft: Partial<MemberDraft>): Promise<string> {
    const validation = validateMemberDraft(draft)
    if (!validation.ok || !validation.member) {
      throw new Error(validation.error ?? 'missing-required')
    }

    const db = await getDb(requireConfig())
    const { addDoc, collection, doc, getDoc, setDoc } = await import('firebase/firestore')

    if (!id) {
      const created = await addDoc(collection(db, 'members'), {
        ...validation.member,
        publishedAt: new Date().toISOString(),
      })
      return created.id
    }

    // An edit preserves the original publication date — it is when the person
    // appeared, not when their biography was last corrected.
    const existing = await getDoc(doc(db, 'members', id))
    const publishedAt =
      (existing.data() as AdminMember | undefined)?.publishedAt ?? new Date().toISOString()
    await setDoc(doc(db, 'members', id), { ...validation.member, publishedAt })
    return id
  },

  async remove(id: string): Promise<void> {
    const db = await getDb(requireConfig())
    const { deleteDoc, doc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'members', id))
  },

  /**
   * Incorporation-form responses that have not been published yet.
   *
   * A response is immutable — it records what somebody actually submitted — so
   * there is no flag on it saying "done". Instead a published profile takes the
   * response's own document id, which makes "already handled" a question about
   * the directory rather than state on the record, and makes publishing the same
   * response twice idempotent rather than duplicating the person.
   */
  async listArrived(): Promise<ArrivedResponse[]> {
    const db = await getDb(requireConfig())
    const { collection, getDocs } = await import('firebase/firestore')
    const [responses, members] = await Promise.all([
      getDocs(collection(db, 'formResponses')),
      getDocs(collection(db, 'members')),
    ])
    const published = new Set(members.docs.map((docSnap) => docSnap.id))

    return responses.docs
      .filter((docSnap) => !published.has(docSnap.id))
      .map((docSnap) => {
        const data = docSnap.data() as { answers?: Record<string, string>; receivedAt?: string }
        const answers = data.answers ?? {}
        return {
          id: docSnap.id,
          receivedAt: data.receivedAt ?? '',
          answers,
          outcome: mapFormResponse(answers),
        }
      })
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  },

  /**
   * Publishes an arrived response, optionally with corrections.
   *
   * `draft` is supplied when a moderator had to resolve something the mapping
   * could not — an institution not on the whitelist, a region that did not match
   * the country. Without it the mapped record is published as-is.
   */
  async publishArrived(id: string, draft?: Partial<MemberDraft>): Promise<void> {
    const db = await getDb(requireConfig())
    const { doc, getDoc, setDoc } = await import('firebase/firestore')

    let member: Omit<Member, 'id' | 'publishedAt'>
    if (draft) {
      const validation = validateMemberDraft(draft)
      if (!validation.ok || !validation.member) {
        throw new Error(validation.error ?? 'missing-required')
      }
      member = validation.member
    } else {
      const snap = await getDoc(doc(db, 'formResponses', id))
      if (!snap.exists()) throw new Error('not-found')
      const answers = (snap.data() as { answers?: Record<string, string> }).answers ?? {}
      const outcome = mapFormResponse(answers)
      if (!outcome.ok || !outcome.member) throw new Error(outcome.error ?? 'missing-required')
      const { email: _held, ...rest } = outcome.member
      member = rest
    }

    // Same id as the response, which is what marks it handled. The response
    // itself is kept: it holds the reply address, and `members` deliberately
    // does not.
    await setDoc(doc(db, 'members', id), {
      ...member,
      publishedAt: new Date().toISOString(),
    })
  },

  /** Discards a response. Spam housekeeping, not a membership decision. */
  async discardArrived(id: string): Promise<void> {
    const db = await getDb(requireConfig())
    const { deleteDoc, doc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'formResponses', id))
  },
}

/* --------------------------------------------------- Editable site content */

/**
 * The collections that hold a list and therefore need the import step. The
 * congress is a single document, so it is not one of these.
 */
export type ContentCollection = 'initiatives' | 'bibliography'

/**
 * The three sections the network maintains itself: Iniciativas, the
 * bibliography, and the congress card.
 *
 * The Resources table (the handful of RELIF PDFs above the bibliography) was
 * editable here too and is not any more — it was never one of the three that
 * were asked for, and an editor nobody was going to open is still a write path
 * that has to be kept correct.
 *
 * Firestore only — there is no Express equivalent, deliberately. The instructor
 * requires Firebase as the backend, `firestore.rules` is what actually enforces
 * moderator-only writes, and a second write path through the prototype server
 * would be a second thing to secure for no benefit. Reads still work on every
 * adapter, so the public site is unaffected by which backend is configured.
 */
export const contentAdmin = {
  /**
   * How many documents the collection actually holds.
   *
   * The public read path falls back to the bundled seed when a collection is
   * empty, so the site showing six cards does not mean six documents exist.
   * The editor has to tell those apart: saving an edit to a seed card would
   * make the collection non-empty and instantly hide the five cards that were
   * never imported. Import is therefore a deliberate first step, and this is
   * how the panel knows whether it has happened.
   */
  async count(kind: ContentCollection): Promise<number> {
    const db = await getDb(requireConfig())
    const { collection, getCountFromServer } = await import('firebase/firestore')
    const snapshot = await getCountFromServer(collection(db, kind))
    return snapshot.data().count
  },

  async saveInitiative(initiative: Initiative): Promise<void> {
    const db = await getDb(requireConfig())
    const { doc, setDoc } = await import('firebase/firestore')
    const { id, ...fields } = initiative
    await setDoc(doc(db, 'initiatives', id), fields)
  },

  async deleteInitiative(id: string): Promise<void> {
    const db = await getDb(requireConfig())
    const { deleteDoc, doc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'initiatives', id))
  },

  /** The congress block is one document, so it is saved whole — no import step. */
  async saveCongress(value: Congress): Promise<void> {
    const db = await getDb(requireConfig())
    const { doc, setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, 'siteContent', 'congress'), value)
  },

  async saveBibliographyEntry(entry: BibliographyEntry): Promise<void> {
    const db = await getDb(requireConfig())
    const { doc, setDoc } = await import('firebase/firestore')
    const { id, ...fields } = entry
    await setDoc(doc(db, 'bibliography', id), fields)
  },

  async deleteBibliographyEntry(id: string): Promise<void> {
    const db = await getDb(requireConfig())
    const { deleteDoc, doc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'bibliography', id))
  },

  /**
   * Copies the bundled seed into Firestore so there is something to edit.
   *
   * Until this runs, both collections are empty and the site renders the seed —
   * which means the admin panel would otherwise show cards that exist on the
   * page but not in the database, and "edit" would have nothing to edit. Import
   * is explicit rather than automatic: a silent first-write on page load would
   * be a surprising thing for opening a dashboard to do.
   */
  async importSeed(kind: ContentCollection): Promise<number> {
    const db = await getDb(requireConfig())
    const { collection, doc, getDocs, writeBatch } = await import('firebase/firestore')
    const existing = await getDocs(collection(db, kind))
    if (!existing.empty) throw new Error('already-populated')

    const records: Array<Record<string, unknown> & { id: string }> =
      kind === 'initiatives'
        ? (await bundledDataSource.getInitiatives()).map((i) => ({ ...i }))
        : (await bundledDataSource.getBibliography()).map((b) => ({ ...b }))

    // Batched so a half-imported collection cannot exist: it either all lands
    // or none of it does, and a partial import would look like deliberate
    // curation to whoever opened the panel next.
    const batch = writeBatch(db)
    for (const record of records) {
      const { id, ...fields } = record
      batch.set(doc(db, kind, id), fields)
    }
    await batch.commit()
    return records.length
  },
}

/**
 * Publishes a stored submission to the public directory.
 *
 * Deliberately NOT part of `adminApi`: nothing in the dashboard may call this.
 * The network does not admit members from a screen — a profile is created once
 * someone has been spoken to and has filled in the incorporation form, and that
 * pipeline is what will call this. Exposing it on the panel's surface is how a
 * publish button gets added back by accident.
 *
 * Named for what it does rather than for a decision it does not represent:
 * this is not an approval, it is the last mechanical step of one.
 */
export function publishSubmission(id: string): Promise<void> {
  return firestoreAdmin.approve(id)
}

/* ------------------------------------------------------------------- Public API */

export const adminApi = {
  backend: adminBackend,

  signIn: (credentials: AdminCredentials): Promise<AdminSession> =>
    adminBackend() === 'firestore'
      ? firestoreAdmin.signIn(credentials.email, credentials.password)
      : httpAdmin.signIn(credentials),

  restore: (): Promise<AdminSession | null> =>
    adminBackend() === 'firestore' ? firestoreAdmin.restore() : httpAdmin.restore(),

  signOut: (): Promise<void> =>
    adminBackend() === 'firestore' ? firestoreAdmin.signOut() : httpAdmin.signOut(),

  listPending: (): Promise<PendingMember[]> =>
    adminBackend() === 'firestore' ? firestoreAdmin.listPending() : httpAdmin.listPending(),

  /** Discards a received request. Housekeeping for spam — not a membership decision. */
  reject: (id: string): Promise<void> =>
    adminBackend() === 'firestore' ? firestoreAdmin.reject(id) : httpAdmin.reject(id),
}
