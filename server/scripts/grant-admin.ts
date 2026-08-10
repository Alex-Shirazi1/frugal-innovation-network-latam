/**
 * Grants or revokes the `admin` custom claim that firestore.rules checks before
 * allowing moderation.
 *
 * Moderation is gated on the claim rather than on merely being signed in, and
 * there is no console UI for setting claims, so this script is the only way in.
 *
 * Authenticates with Application Default Credentials, so no service-account key
 * file is ever downloaded or left on disk:
 *
 *   gcloud auth application-default login
 *   npm run grant-admin -- someone@example.com
 *   npm run grant-admin -- someone@example.com --revoke
 *
 * The target account must already exist in Firebase Auth — created in the
 * console under Authentication > Users, or by signing in to /admin once —
 * because a claim can only be attached to an existing user record.
 */
import { cert, initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const email = args.find((a) => !a.startsWith('--'))
const revoke = args.includes('--revoke')
const keyFile = args.find((a) => a.startsWith('--key='))?.slice('--key='.length)

if (!email) {
  console.error('usage: npm run grant-admin -- <email> [--revoke] [--key=path/to/sa.json]')
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

try {
  const user = await auth.getUserByEmail(email)
  const existing = user.customClaims ?? {}

  if (revoke) {
    const { admin: _dropped, ...rest } = existing
    await auth.setCustomUserClaims(user.uid, rest)
    console.log(`revoked admin from ${email} (${user.uid})`)
  } else {
    // Merge rather than replace, so any unrelated claims survive.
    await auth.setCustomUserClaims(user.uid, { ...existing, admin: true })
    console.log(`granted admin to ${email} (${user.uid})`)
  }

  const after = (await auth.getUser(user.uid)).customClaims
  console.log('claims now:', JSON.stringify(after))
  console.log('\nThe account must sign out and back in (or hard-refresh /admin)')
  console.log('for the new token to carry the claim.')
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('no user record')) {
    console.error(
      `No account for ${email}. Create it first in the Firebase console under\n` +
        'Authentication > Users (Email/Password), then run this again — a claim\n' +
        'can only attach to an existing user record.',
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
