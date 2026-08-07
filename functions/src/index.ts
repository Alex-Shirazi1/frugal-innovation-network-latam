/**
 * RELIF Cloud Functions.
 *
 * One job today: when someone completes the new-member form on the site, tell
 * the network about it by email. Allan's flow starts there — the form is an
 * expression of interest, and the network replies to arrange a conversation.
 *
 * Delivery goes through the official "Trigger Email from Firestore" extension
 * rather than an SMTP client in this codebase. This function only formats the
 * message and drops it in the `mail` collection the extension watches; the
 * extension owns credentials, retries and the send itself. That keeps SMTP
 * secrets out of the repo and leaves one moving part to hand over.
 *
 * The client cannot write to `mail` (see firestore.rules) — the Admin SDK used
 * here bypasses rules, which is exactly why the write happens server-side.
 *
 * Setup, in order:
 *   1. Upgrade the Firebase project to the Blaze plan (Functions requires it).
 *   2. firebase ext:install firebase/firestore-send-email
 *      - Collection: mail
 *      - SMTP: the network's own Gmail account + an app password
 *      - Default FROM: the same address
 *   3. Set RELIF_NOTIFY_TO / RELIF_ADMIN_URL in functions/.env (see .env.example)
 *   4. npm --prefix functions run deploy
 */
import { setGlobalOptions } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/firestore'
import { logger } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import { buildMessage, fullNameOf, type SubmissionDocument } from './format.js'

initializeApp()

/**
 * The network gets a handful of applications a week at most. Capping instances
 * keeps a runaway loop or a bot flood from turning into a bill — the whole
 * reason Functions was avoided here until Allan confirmed billing was fine.
 */
setGlobalOptions({ maxInstances: 3, region: 'us-central1' })

const NOTIFY_TO = process.env.RELIF_NOTIFY_TO ?? 'redinnovacionfrugal@gmail.com'
const ADMIN_URL = process.env.RELIF_ADMIN_URL ?? 'https://redinnovacionfrugal.lat/admin'

export const notifyNewSubmission = onDocumentCreated('submissions/{submissionId}', async (event) => {
  const submission = event.data?.data() as SubmissionDocument | undefined
  if (!submission) {
    logger.warn('submission created with no data', { submissionId: event.params.submissionId })
    return
  }

  await getFirestore()
    .collection('mail')
    .add({
      to: [NOTIFY_TO],
      message: buildMessage(submission, ADMIN_URL),
    })

  // Deliberately no personal data in the log line: the whole point of keeping
  // `submissions` unreadable is that this is PII for people who have not been
  // approved for publication.
  logger.info('queued new-member notification', {
    submissionId: event.params.submissionId,
    named: fullNameOf(submission) !== 'Solicitante sin nombre',
  })
})
