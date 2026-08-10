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

/** Ports declared for the emulator suite in firebase.json. */
const EMULATOR_HOST = '127.0.0.1'
const EMULATOR_FIRESTORE_PORT = 8080
const EMULATOR_AUTH_PORT = 9099

/**
 * Whether to point the SDK at the local emulator suite instead of the real
 * project.
 *
 * Gated on `import.meta.env.DEV` as well as the flag, and deliberately a
 * module-local `const` rather than an exported function: Vite replaces DEV with
 * a literal, so in a production build this folds to `false`, and the bundler can
 * then drop both `if` blocks below along with the host and port constants they
 * are the only readers of. An exported function would survive as a live symbol
 * and leave the branches in the bundle as dead code — same guarantee, but one
 * you have to argue for instead of read off the output.
 *
 * The practical effect either way: setting this variable in a deploy
 * environment cannot aim the live site at someone's laptop.
 */
const USE_EMULATOR = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR === 'true'

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

// Both connect* calls throw if the handle has already issued a request, so each
// is memoised rather than run per caller.
let dbPromise: Promise<Firestore> | null = null
let authPromise: Promise<Auth> | null = null

export async function getDb(config: FirebaseConfig): Promise<Firestore> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const app = await getApp(config)
      const { getFirestore } = await import('firebase/firestore')
      const db = getFirestore(app)
      // Imported inside the branch, not above it, so a production build drops
      // the binding along with the branch rather than keeping an unused one.
      if (USE_EMULATOR) {
        const { connectFirestoreEmulator } = await import('firebase/firestore')
        connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_FIRESTORE_PORT)
      }
      return db
    })()
  }
  return dbPromise
}

export async function getAuthClient(config: FirebaseConfig): Promise<Auth> {
  if (!authPromise) {
    authPromise = (async () => {
      const app = await getApp(config)
      const { getAuth } = await import('firebase/auth')
      const auth = getAuth(app)
      if (USE_EMULATOR) {
        const { connectAuthEmulator } = await import('firebase/auth')
        // disableWarnings: the banner it injects otherwise overlays the panel.
        connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_AUTH_PORT}`, {
          disableWarnings: true,
        })
      }
      return auth
    })()
  }
  return authPromise
}
