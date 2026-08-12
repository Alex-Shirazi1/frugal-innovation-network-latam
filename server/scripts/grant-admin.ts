/**
 * Creates a moderator account, and grants or revokes the `admin` custom claim
 * that firestore.rules checks before allowing moderation.
 *
 * Moderation is gated on the claim rather than on merely being signed in, and
 * there is no console UI for setting claims, so this script is the only way in.
 *
 * Authenticates with Application Default Credentials, so no service-account key
 * file is ever downloaded or left on disk:
 *
 *   gcloud auth application-default login
 *   npm run grant-admin -- someone@example.com --create
 *   npm run grant-admin -- someone@example.com
 *   npm run grant-admin -- someone@example.com --revoke
 *
 * `--create` makes the account when it does not exist yet and prints a
 * password-reset link instead of setting a password. That is the point: a
 * password passed on a command line is in the shell history, the terminal
 * scrollback and anything reading either. Sending the person to a reset link
 * means the only copies are Firebase Auth's hash and their password manager.
 *
 * Without `--create` the account must already exist, because a claim can only
 * be attached to an existing user record.
 */
import { cert, initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const email = args.find((a) => !a.startsWith('--'))
const revoke = args.includes('--revoke')
const create = args.includes('--create')
const keyFile = args.find((a) => a.startsWith('--key='))?.slice('--key='.length)

/**
 * Which claim to operate on.
 *
 * `importer` is for the Google Form transport account and grants strictly less
 * than `admin`: it may deposit raw form responses and nothing else — it cannot
 * read the responses back, and it cannot publish anyone to the directory. Kept
 * as a separate claim rather than a lesser admin so that the password living in
 * Apps Script can never become moderator access.
 */
const claim: 'admin' | 'importer' = args.includes('--importer') ? 'importer' : 'admin'

if (!email) {
  console.error(
    'usage: npm run grant-admin -- <email> [--create] [--revoke] [--importer]\n' +
      '                            [--key=path/to/sa.json]\n\n' +
      '  --importer  operate on the form-transport claim instead of admin',
  )
  process.exit(1)
}

if (create && revoke) {
  console.error('--create and --revoke contradict each other; pick one.')
  process.exit(1)
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'raif-af800'

if (getApps().length === 0) {
  // A key file is supported as a fallback for environments without gcloud, but
  // ADC is the default because it leaves no long-lived secret behind.
  initializeApp({
    credential: keyFile
      ? cert(JSON.parse(readFileSync(keyFile, 'utf8')))
      : applicationDefault(),
    projectId,
  })
}

const auth = getAuth()

/**
 * Fetches the account, creating it first when asked to.
 *
 * Created with no password at all rather than a generated one. Firebase is
 * happy to hold a passwordless email account, and the reset link below is what
 * gives it a password — so there is never a moment where a working password
 * exists that the person does not control.
 */
async function resolveUser() {
  try {
    return await auth.getUserByEmail(email!)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (!create || !message.includes('no user record')) throw error
    const created = await auth.createUser({ email: email!, emailVerified: false })
    console.log(`created ${email} (${created.uid})`)
    return created
  }
}

try {
  const user = await resolveUser()
  const existing = user.customClaims ?? {}

  if (revoke) {
    // Drop only the claim being operated on; any other claim survives.
    const rest = { ...existing }
    delete rest[claim]
    await auth.setCustomUserClaims(user.uid, rest)
    console.log(`revoked ${claim} from ${email} (${user.uid})`)
  } else {
    // Merge rather than replace, so any unrelated claims survive.
    await auth.setCustomUserClaims(user.uid, { ...existing, [claim]: true })
    console.log(`granted ${claim} to ${email} (${user.uid})`)
  }

  const after = (await auth.getUser(user.uid)).customClaims
  console.log('claims now:', JSON.stringify(after))

  if (create && !revoke) {
    // Printed rather than emailed: Firebase only sends this itself through its
    // own template, and the address may well be a shared inbox nobody is
    // watching right now. Handing over the link puts the choice of how it
    // travels with whoever ran the command.
    const link = await auth.generatePasswordResetLink(email)
    console.log('\nSet the password with this link (single use, expires in an hour):\n')
    console.log(`  ${link}\n`)
    console.log('Choose it in a password manager rather than inventing one here.')
  }

  console.log('\nThe account must sign out and back in (or hard-refresh /admin)')
  console.log('for the new token to carry the claim.')
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('no user record')) {
    console.error(
      `No account for ${email}. Re-run with --create to make one, or add it in\n` +
        'the Firebase console under Authentication > Users — a claim can only\n' +
        'attach to an existing user record.',
    )
  } else if (message.includes('CONFIGURATION_NOT_FOUND')) {
    console.error(
      'Email/Password sign-in is not enabled on this project. Turn it on under\n' +
        'Authentication > Sign-in method, then run this again.',
    )
  } else if (message.includes('Could not load the default credentials')) {
    console.error(
      'No credentials found. Run:\n  gcloud auth application-default login\n' +
        'or pass --key=path/to/serviceAccountKey.json',
    )
  } else {
    console.error(message)
  }
  process.exit(1)
}
