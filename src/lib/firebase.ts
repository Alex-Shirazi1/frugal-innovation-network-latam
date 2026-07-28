/**
 * Lazy Firebase initialisation.
 *
 * The SDK is ~100kb gzipped, which would blow the landing-page bundle budget if
 * imported eagerly. Everything here is behind a dynamic import, so Firebase
 * lands in its own chunk that is fetched only when the site actually talks to
 * Firestore — and never at all in bundled/static mode.
 */
import type { FirebaseApp } from 'firebase/app'
import type { Firestore } from 'firebase/firestore'
import type { Auth } from 'firebase/auth'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
}

/**
 * Reads config from Vite env vars. Returns null when unconfigured so callers
 * can fall back to bundled data instead of throwing at module load.
 */
export function readFirebaseConfig(): FirebaseConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID
  const authDomain =
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ??
    (projectId ? `${projectId}.firebaseapp.com` : undefined)

  if (!apiKey || !projectId || !appId || !authDomain) return null
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  }
}

let appPromise: Promise<FirebaseApp> | null = null

async function getApp(config: FirebaseConfig): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp, getApps, getApp: getExisting } = await import('firebase/app')
      // Vite HMR can re-run this module; reuse the existing app if present.
      return getApps().length > 0 ? getExisting() : initializeApp(config)
    })()
  }
  return appPromise
}

export async function getDb(config: FirebaseConfig): Promise<Firestore> {
  const app = await getApp(config)
  const { getFirestore } = await import('firebase/firestore')
  return getFirestore(app)
}

export async function getAuthClient(config: FirebaseConfig): Promise<Auth> {
  const app = await getApp(config)
  const { getAuth } = await import('firebase/auth')
  return getAuth(app)
}
