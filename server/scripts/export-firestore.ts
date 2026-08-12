/**
 * Dumps every Firestore collection to a timestamped JSON file on disk.
 *
 * There is otherwise no backup of any kind. Managed Firestore backups and
 * scheduled exports to Cloud Storage both require the Blaze plan, and this
 * project stays on Spark, so recovery from a bad delete currently means the
 * repository seed — which restores the bundled content and loses every real
 * edit, every published member, and the whole submission queue. A moderator
 * account is one password away from all of that. This script is the answer
 * until billing is on the table.
 *
 *   npm run export
 *   npm run export -- --out=~/relif-backups
 *
 * Authenticates with Application Default Credentials, like grant-admin and
 * seed-members:
 *
 *   gcloud auth application-default login
 *
 * ---------------------------------------------------------------------------
 * THE OUTPUT CONTAINS PERSONAL DATA AND MUST NOT BE COMMITTED.
 *
 * `submissions` and `formResponses` hold what people typed into the
 * incorporation form, including email addresses that are deliberately kept out
 * of the world-readable `members` collection. A committed export would publish,
 * in a public repository and in its history for good, exactly the field the
 * rules go out of their way to withhold. The default output directory is
 * gitignored for that reason; keep any --out path outside the repository.
 * ---------------------------------------------------------------------------
 *
 * Read-only: it opens no writes and takes no --confirm, because a backup that
 * is tedious to run is a backup nobody runs. The project id is printed so a run
 * against the wrong project is visible in the output rather than silent.
 */
import { cert, initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

/**
 * Every collection the site stores. Listed here rather than discovered with
 * listCollections() so that a collection which happens to be empty on the day
 * of the run still appears in the export as an empty array — the difference
 * between "we have no members" and "members were not backed up" is one somebody
 * will need during a restore.
 */
const COLLECTIONS = [
  'members',
  'submissions',
  'formResponses',
  'initiatives',
  'bibliography',
  'resources',
  'siteContent',
] as const

/** Collections whose documents contain personal data, flagged in the output. */
const SENSITIVE = new Set(['submissions', 'formResponses'])

const DEFAULT_OUT = 'firestore-backups'

const args = process.argv.slice(2)
const keyFile = args.find((a) => a.startsWith('--key='))?.slice('--key='.length)
const outArg = args.find((a) => a.startsWith('--out='))?.slice('--out='.length)
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'raif-af800'

/** `~` is expanded by the shell only when unquoted, and --out= is often quoted. */
const outDir = resolve((outArg ?? DEFAULT_OUT).replace(/^~(?=$|\/)/, homedir()))

if (getApps().length === 0) {
  // A key file is supported as a fallback for environments without gcloud, but
  // ADC is the default because it leaves no long-lived secret behind.
  initializeApp({
    credential: keyFile ? cert(JSON.parse(readFileSync(keyFile, 'utf8'))) : applicationDefault(),
    projectId,
  })
}

const db = getFirestore()

/**
 * Firestore hands back Timestamp and GeoPoint instances, which JSON.stringify
 * flattens into shapes that cannot be read back (`{"_seconds":...}`). Converting
 * timestamps to ISO strings keeps the export in the same format the application
 * already writes, so a restore does not have to know which fields were which.
 */
function toPlain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(toPlain)
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]))
  }
  return value
}

try {
  console.log(`project: ${projectId}`)

  const collections: Record<string, { id: string; data: unknown }[]> = {}
  const counts: string[] = []

  for (const name of COLLECTIONS) {
    const snapshot = await db.collection(name).get()
    collections[name] = snapshot.docs.map((d) => ({ id: d.id, data: toPlain(d.data()) }))
    counts.push(`  ${name.padEnd(15)} ${snapshot.size}`)
  }

  const exportedAt = new Date().toISOString()
  // Colons are legal on macOS and Linux but not on Windows, and a backup nobody
  // can copy to a second machine is half a backup.
  const stamp = exportedAt.replace(/[:.]/g, '-')
  const file = resolve(outDir, `${projectId}-${stamp}.json`)

  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        exportedAt,
        projectId,
        containsPersonalData: [...SENSITIVE],
        collections,
      },
      null,
      2,
    )}\n`,
  )

  const total = Object.values(collections).reduce((sum, docs) => sum + docs.length, 0)
  console.log(counts.join('\n'))
  console.log(`\nwrote ${total} document(s) to ${file}`)
  console.log(
    '\nThis file contains personal data from submissions and formResponses.\n' +
      'Do not commit it, and do not copy it anywhere the public can read.',
  )
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('Could not load the default credentials')) {
    console.error(
      'No credentials found. Run:\n  gcloud auth application-default login\n' +
        'or pass --key=path/to/serviceAccountKey.json',
    )
  } else if (message.includes('invalid_grant') || message.includes('invalid_rapt')) {
    // Stored ADC exists but is expired, revoked, or belongs to an account with
    // no access to this project — which reads as an opaque "400 undefined"
    // otherwise. Worth naming, because the fix is not obvious from the message.
    console.error(
      `Credentials were rejected for project "${projectId}".\n\n` +
        'The stored application-default credentials are expired, revoked, or belong\n' +
        'to an account without access to this project. Sign in again as the account\n' +
        'that owns it:\n\n' +
        '  gcloud auth application-default login\n\n' +
        'Nothing was exported.',
    )
  } else {
    console.error(message)
  }
  process.exit(1)
}
