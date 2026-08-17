/**
 * Loads the bundled directory in src/data/members.ts into Firestore.
 *
 * This used to write 54 fabricated profiles and existed only for preproduction.
 * It does not any more: the bundled seed now holds real, consenting members, so
 * this is the legitimate way to populate a fresh project's directory.
 *
 * THE DANGER MOVED RATHER THAN WENT AWAY. This CLEARS the members collection
 * before writing, so any profile published through the panel and not present in
 * the bundle is destroyed — and published profiles are exactly what does not
 * come back from the repo. Run `npm run export` first. The project id is printed
 * and --confirm is required for that reason, not because the data is fake.
 *
 *   npm run seed:members -- --confirm
 *   npm run seed:members -- --clear --confirm     # remove every stored profile
 *
 * Authenticates with Application Default Credentials, like grant-admin:
 *
 *   gcloud auth application-default login
 *
 * ---------------------------------------------------------------------------
 * Every record is validated with validateMemberDraft before it is written, even
 * though the Admin SDK bypasses security rules. That is deliberate: an unchecked
 * write could create a document the panel itself cannot edit, since edits go back
 * through the same validator and through firestore.rules. Validating here means
 * the seeded rows are exactly what the panel would have produced, which is the
 * only way testing against them proves anything.
 * ---------------------------------------------------------------------------
 */
import { cert, initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

import { seedMembers } from '../../src/data/members'
import { toDraft, validateMemberDraft } from '../../src/domain/memberDraft'

const args = process.argv.slice(2)
const clear = args.includes('--clear')
const confirmed = args.includes('--confirm')
const keyFile = args.find((a) => a.startsWith('--key='))?.slice('--key='.length)
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'relif-s-website'

if (!confirmed) {
  console.error(
    `This REPLACES the members collection of project "${projectId}" with the\n` +
      `${seedMembers.length} profile(s) bundled in the repo. Any profile published through the\n` +
      'panel and not present in the bundle is deleted and does not come back.\n\n' +
      'Run `npm run export` first, then re-run with --confirm.\n' +
      '  npm run seed:members -- --confirm\n' +
      '  npm run seed:members -- --clear --confirm',
  )
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    credential: keyFile ? cert(JSON.parse(readFileSync(keyFile, 'utf8'))) : applicationDefault(),
    projectId,
  })
}

const db = getFirestore()
const members = db.collection('members')

/** Deletes in batches — a collection has no single-call truncate. */
async function clearAll(): Promise<number> {
  const snapshot = await members.get()
  if (snapshot.empty) return 0
  let removed = 0
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const batch = db.batch()
    for (const document of snapshot.docs.slice(i, i + 400)) batch.delete(document.ref)
    await batch.commit()
    removed += Math.min(400, snapshot.docs.length - i)
  }
  return removed
}

try {
  console.log(`project: ${projectId}`)

  const removed = await clearAll()
  if (removed) console.log(`removed ${removed} existing profile(s)`)
  if (clear) {
    console.log('done — the directory now falls back to the bundled seed.')
    process.exit(0)
  }

  // Validate everything before writing anything, so a rejected record cannot
  // leave the collection half-populated.
  const prepared: { id: string; data: Record<string, unknown> }[] = []
  const rejected: string[] = []

  seedMembers.forEach((member, index) => {
    const validation = validateMemberDraft(toDraft(member))
    if (!validation.ok || !validation.member) {
      rejected.push(`${member.fullName}: ${validation.error}`)
      return
    }
    prepared.push({
      id: member.id,
      data: {
        ...validation.member,
        /*
         * Staggered rather than all identical, so the panel's dates read like a
         * directory that grew over time instead of one bulk import. Derived from
         * the index so repeated runs produce the same dates.
         */
        publishedAt: new Date(Date.now() - index * 36 * 60 * 60 * 1000).toISOString(),
      },
    })
  })

  if (rejected.length) {
    console.error(`\n${rejected.length} record(s) would not validate — nothing was written:`)
    for (const line of rejected) console.error(`  ${line}`)
    process.exit(1)
  }

  for (let i = 0; i < prepared.length; i += 400) {
    const batch = db.batch()
    for (const record of prepared.slice(i, i + 400)) {
      batch.set(members.doc(record.id), record.data)
    }
    await batch.commit()
  }

  console.log(`wrote ${prepared.length} profiles to members/`)
  console.log('\nThe directory now serves these from Firestore rather than the bundle.')
  console.log('Further members should arrive through the incorporation form, not here.')
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
        'Nothing was written.',
    )
  } else {
    console.error(message)
  }
  process.exit(1)
}
