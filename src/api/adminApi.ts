/**
 * Moderation client.
 *
 * Two backends behind one interface:
 *
 *  - Firestore (hosted): Google sign-in plus an `admin` custom claim, enforced
 *    by firestore.rules. A static site cannot hold a secret, so the shared-key
 *    scheme below is NOT usable in production.
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

export type AdminBackend = 'firestore' | 'http'

export function adminBackend(): AdminBackend {
  return resolveDataSourceKind() === 'firestore' ? 'firestore' : 'http'
}

export interface AdminSession {
  backend: AdminBackend
  /** Display label for whoever is signed in (email, or "local admin"). */
  label: string
}

/* ------------------------------------------------------------------ Firestore */

interface SubmissionDocument {
  firstName: string
  lastName: string
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
  /** Google sign-in, then verify the claim actually grants moderation. */
  async signIn(): Promise<AdminSession> {
    const config = requireConfig()
    const auth = await getAuthClient(config)
    const { GoogleAuthProvider, signInWithPopup, signOut } = await import('firebase/auth')
    const credential = await signInWithPopup(auth, new GoogleAuthProvider())

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
  async signIn(adminKey: string): Promise<AdminSession> {
    await keyedRequest('/admin/login', adminKey, { method: 'POST' })
    sessionStorage.setItem(KEY_STORAGE, adminKey)
    return { backend: 'http', label: 'local admin' }
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

/* ------------------------------------------------------------------- Public API */

export const adminApi = {
  backend: adminBackend,

  /** `secret` is only meaningful for the local Express backend. */
  signIn: (secret?: string): Promise<AdminSession> =>
    adminBackend() === 'firestore' ? firestoreAdmin.signIn() : httpAdmin.signIn(secret ?? ''),

  restore: (): Promise<AdminSession | null> =>
    adminBackend() === 'firestore' ? firestoreAdmin.restore() : httpAdmin.restore(),

  signOut: (): Promise<void> =>
    adminBackend() === 'firestore' ? firestoreAdmin.signOut() : httpAdmin.signOut(),

  listPending: (): Promise<PendingMember[]> =>
    adminBackend() === 'firestore' ? firestoreAdmin.listPending() : httpAdmin.listPending(),

  approve: (id: string): Promise<void> =>
    adminBackend() === 'firestore' ? firestoreAdmin.approve(id) : httpAdmin.approve(id),

  reject: (id: string): Promise<void> =>
    adminBackend() === 'firestore' ? firestoreAdmin.reject(id) : httpAdmin.reject(id),
}
