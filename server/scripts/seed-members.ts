/**
 * Loads the mock directory into Firestore, for exercising the members panel
 * against real documents.
 *
 * FOR A PREPRODUCTION PROJECT. These 54 people are fabricated — invented names,
 * job titles, biographies and social links — and the whole point of the members
 * tab is to replace them with real profiles from the incorporation form. Running
 * this against a project the public reads is putting fake people on the open web,
 * so the project id is printed and --confirm is required.
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

import { mockMembers } from '../../src/data/members'
import { toDraft, validateMemberDraft } from '../../src/domain/memberDraft'

const args = process.argv.slice(2)
const clear = args.includes('--clear')
const confirmed = args.includes('--confirm')
const keyFile = args.find((a) => a.startsWith('--key='))?.slice('--key='.length)
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'raif-af800'

if (!confirmed) {
  console.error(
    `This writes ${mockMembers.length} FABRICATED profiles into the members collection\n` +
      `of project "${projectId}", which the public directory renders.\n\n` +
      'Re-run with --confirm if that is a preproduction project.\n' +
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

  mockMembers.forEach((member, index) => {
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
  console.log('\nThese are fabricated. Delete them from the panel, or re-run with')
  console.log('--clear --confirm, once real profiles exist.')
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('Could not load the default credentials')) {
    console.error(
      'No credentials found. Run:\n  gcloud auth application-default login\n' +
        'or pass --key=path/to/serviceAccountKey.json',
    )
  } else {
    console.error(message)
  }
  process.exit(1)
}
