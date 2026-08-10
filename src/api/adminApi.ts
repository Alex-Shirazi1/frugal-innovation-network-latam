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
  firstName: string
  lastName: string
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
  const fullName = `${d.firstName} ${d.lastName}`
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    fullName,
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
    avatarHue: avatarHueFor(fullName),
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
    await setDoc(doc(db, 'members', id), toPublishedMember(snap.data() as SubmissionDocument))
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
