/**
 * Seeds the local Firebase emulator with an admin account and a few
 * submissions, so `/admin` can be opened and reviewed without touching the
 * live project.
 *
 * Why this exists rather than a "skip auth in dev" flag: a bypass would be real
 * code in the production bundle, guarding the admin panel on a build variable.
 * This runs the *same* sign-in path production runs — Firebase Auth, the
 * `admin` custom claim, and firestore.rules — against a throwaway database. The
 * only thing that differs is which host the SDK talks to.
 *
 * Refuses to run unless the emulator host variables are set, so it can never be
 * pointed at the real project by accident.
 *
 *   npm run emulators          # terminal 1
 *   npm run seed:emulator      # terminal 2
 *   npm run dev                # terminal 3, then open /admin
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const AUTH_HOST = '127.0.0.1:9099'
const FIRESTORE_HOST = '127.0.0.1:8080'
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'raif-af800'

/**
 * Development credentials, and deliberately nothing like the real ones.
 *
 * These are safe to keep in the repository because they only ever exist inside
 * the emulator: the emulator's user store is in-memory, is discarded when the
 * process stops, and is unreachable from anywhere but this machine. The
 * production account is created by hand in the Firebase console and its
 * password is never written down here — see README, "Admin access".
 *
 * Firebase Auth enforces a six-character minimum, so this is `admin123` rather
 * than the `admin`/`admin` you would otherwise expect.
 */
const PASSWORD = 'admin123'
const ACCOUNTS = [
  // Short one, for typing repeatedly.
  'admin@relif.test',
  // The address the network will actually use, so local sign-in rehearses the
  // real thing rather than something that only resembles it.
  'contacto@redinnovacionfrugal.lat',
]

// Set before initializeApp so the SDK talks to the emulator and skips
// credential discovery entirely — no service account, no gcloud login.
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST
process.env.FIRESTORE_EMULATOR_HOST ??= FIRESTORE_HOST

if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH_HOST ||
  process.env.FIRESTORE_EMULATOR_HOST !== FIRESTORE_HOST
) {
  console.error(
    'Emulator hosts point somewhere unexpected. This script only ever seeds a\n' +
      'local emulator — refusing to run so it cannot write to a real project.',
  )
  process.exit(1)
}

async function reachable(host: string): Promise<boolean> {
  try {
    await fetch(`http://${host}/`, { signal: AbortSignal.timeout(1500) })
    return true
  } catch {
    return false
  }
}

if (!(await reachable(AUTH_HOST)) || !(await reachable(FIRESTORE_HOST))) {
  console.error(`No emulator on ${AUTH_HOST} / ${FIRESTORE_HOST}. Start it first:\n`)
  console.error('  npm run emulators\n')
  process.exit(1)
}

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID })

const auth = getAuth()
const db = getFirestore()

for (const email of ACCOUNTS) {
  // Re-running should be harmless, so an existing account is updated in place
  // rather than treated as an error.
  const existing = await auth.getUserByEmail(email).catch(() => null)
  const user = existing
    ? await auth.updateUser(existing.uid, { password: PASSWORD, emailVerified: true })
    : await auth.createUser({ email, password: PASSWORD, emailVerified: true })

  // The claim, not the sign-in, is what firestore.rules authorises on.
  await auth.setCustomUserClaims(user.uid, { admin: true })
  console.log(`${existing ? 'updated' : 'created'} ${email} (admin claim set)`)
}

/**
 * A few requests so the Solicitudes tab has something in it. The other tabs are
 * left empty on purpose — an empty collection is what triggers the panel's
 * "import the bundled seed" step, which is worth seeing rather than skipping.
 */
const SUBMISSIONS = [
  {
    fullName: 'Ana Prueba García',
    email: 'ana.prueba@example.org',
    position: 'researcher',
    jobPositionName: 'Investigadora Asociada',
    biography: 'Trabaja en salud comunitaria y energía asequible en el occidente de México.',
    affiliationId: 'iteso',
    country: 'México',
    region: 'Jalisco',
    interestIds: ['salud', 'energia'],
    generalAreaIds: ['ingenieria'],
    languages: ['es', 'en'],
    socialUrl: 'https://linkedin.com/in/ana-prueba',
  },
  {
    fullName: 'Bruno Cardoso Lima',
    email: 'bruno.cardoso@example.org',
    position: 'faculty',
    jobPositionName: 'Professor Adjunto',
    biography: 'Pesquisa tecnologias sociais e saneamento de baixo custo.',
    affiliationId: null,
    country: 'Brasil',
    region: 'São Paulo',
    interestIds: ['agua'],
    generalAreaIds: ['ciencias-sociales'],
    languages: ['pt', 'es'],
    socialUrl: null,
  },
  {
    fullName: 'Carla Núñez Ortega',
    email: 'carla.nunez@example.org',
    position: 'independent',
    jobPositionName: 'Consultora independiente',
    biography: 'Diseña programas de innovación frugal con cooperativas rurales.',
    affiliationId: null,
    country: 'Colombia',
    region: 'Antioquia',
    interestIds: ['educacion'],
    generalAreaIds: ['diseno-arte'],
    languages: ['es'],
    socialUrl: null,
  },
] as const

const existingSubmissions = await db.collection('submissions').get()
if (existingSubmissions.empty) {
  const batch = db.batch()
  SUBMISSIONS.forEach((submission, index) => {
    batch.set(db.collection('submissions').doc(`seed-${index + 1}`), {
      ...submission,
      consentToPublish: true,
      status: 'pending',
      // Spaced a day apart so the queue's ordering is visible at a glance.
      createdAt: new Date(Date.UTC(2026, 7, 3 + index, 14, 30)).toISOString(),
    })
  })
  await batch.commit()
  console.log(`seeded ${SUBMISSIONS.length} pending submissions`)
} else {
  console.log(`submissions already present (${existingSubmissions.size}) — left alone`)
}

console.log('\nSign in at /admin with:')
console.log(`  ${ACCOUNTS[0]}  /  ${PASSWORD}`)
