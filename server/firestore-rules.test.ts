/**
 * Behavioural tests for firestore.rules, run against the real Firestore
 * emulator. These are the tests that matter for the hosted deployment: in
 * production the rules ARE the backend, so a rule that merely parses is not
 * enough — it has to actually refuse the things it claims to refuse.
 *
 * Skipped automatically when the emulator is not running, so `npm test` still
 * works on a machine without Java. Run the full check with:
 *   npm run test:rules
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'

const HOST = '127.0.0.1'
const PORT = 8080

/** A payload that satisfies every generated rule. */
function validSubmission(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Ada',
    lastName: 'Lovelace',
    position: 'researcher',
    jobPositionName: 'Investigadora Asociada',
    biography: 'Trabaja en innovación frugal aplicada a salud comunitaria.',
    affiliationId: 'iteso',
    country: 'México',
    region: 'Jalisco',
    interestIds: ['salud', 'energia'],
    generalAreaIds: ['ingenieria'],
    languages: ['es', 'en'],
    socialUrl: 'https://linkedin.com/in/ada',
    consentToPublish: true,
    status: 'pending',
    createdAt: '2026-07-28T00:00:00.000Z',
    ...overrides,
  }
}

let testEnv: RulesTestEnvironment | undefined

async function emulatorRunning(): Promise<boolean> {
  try {
    await fetch(`http://${HOST}:${PORT}/`, { signal: AbortSignal.timeout(1500) })
    return true
  } catch {
    return false
  }
}

const available = await emulatorRunning()

describe.skipIf(!available)('firestore.rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'relif-rules-test',
      firestore: { host: HOST, port: PORT, rules: readFileSync('firestore.rules', 'utf8') },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv?.clearFirestore()
  })

  const anon = () => testEnv!.unauthenticatedContext().firestore()
  const signedIn = () => testEnv!.authenticatedContext('someone').firestore()
  const admin = () => testEnv!.authenticatedContext('allan', { admin: true }).firestore()

  describe('submissions — public intake', () => {
    it('accepts a fully valid submission from an anonymous visitor', async () => {
      await assertSucceeds(addDoc(collection(anon(), 'submissions'), validSubmission()))
    })

    it('rejects a submission that pre-approves itself', async () => {
      await assertFails(
        addDoc(collection(anon(), 'submissions'), validSubmission({ status: 'approved' })),
      )
    })

    it('rejects a submission without consent', async () => {
      await assertFails(
        addDoc(collection(anon(), 'submissions'), validSubmission({ consentToPublish: false })),
      )
    })

    it.each([
      ['blank first name', { firstName: '' }],
      ['overlong first name', { firstName: 'x'.repeat(61) }],
      ['overlong biography', { biography: 'x'.repeat(801) }],
      ['unknown position', { position: 'hacker' }],
      ['region not in the chosen country', { region: 'Lima' }],
      ['unknown country', { country: 'Atlantis' }],
      ['unknown affiliation', { affiliationId: 'not-real' }],
      ['unknown interest id', { interestIds: ['bogus'] }],
      ['empty interest list', { interestIds: [] }],
      ['unknown area id', { generalAreaIds: ['bogus'] }],
      ['too many areas', { generalAreaIds: ['ingenieria', 'negocios', 'derecho', 'agronomia'] }],
      ['unknown language', { languages: ['xx'] }],
      ['javascript: social url', { socialUrl: 'javascript:alert(1)' }],
      ['non-list interests', { interestIds: 'salud' }],
      ['numeric first name', { firstName: 42 }],
    ])('rejects %s', async (_label, patch) => {
      await assertFails(addDoc(collection(anon(), 'submissions'), validSubmission(patch)))
    })

    /**
     * The forged-identity case. fullName/title/avatarHue are derived, so
     * accepting them from a client would let a submitter control how they are
     * displayed regardless of what they actually entered.
     */
    it('rejects derived fields supplied by the client', async () => {
      for (const patch of [
        { fullName: 'Someone Else' },
        { title: { es: 'x', en: 'x', pt: 'x' } },
        { avatarHue: 200 },
        { id: 'forged' },
      ]) {
        await assertFails(addDoc(collection(anon(), 'submissions'), validSubmission(patch)))
      }
    })

    it('never lets the public read the intake queue', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'submissions/s1'), validSubmission())
      })
      await assertFails(getDoc(doc(anon(), 'submissions/s1')))
      await assertFails(getDocs(collection(anon(), 'submissions')))
    })

    it('does not treat merely being signed in as moderator access', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'submissions/s1'), validSubmission())
      })
      await assertFails(getDoc(doc(signedIn(), 'submissions/s1')))
      await assertFails(deleteDoc(doc(signedIn(), 'submissions/s1')))
    })

    it('lets a claim-bearing admin read and clear the queue', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'submissions/s1'), validSubmission())
      })
      await assertSucceeds(getDoc(doc(admin(), 'submissions/s1')))
      await assertSucceeds(deleteDoc(doc(admin(), 'submissions/s1')))
    })
  })

  describe('members — published directory', () => {
    beforeEach(async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'members/m1'), { fullName: 'Ada Lovelace' })
      })
    })

    it('is readable by anyone', async () => {
      await assertSucceeds(getDoc(doc(anon(), 'members/m1')))
      await assertSucceeds(getDocs(collection(anon(), 'members')))
    })

    it('cannot be written by the public or by a plain signed-in user', async () => {
      await assertFails(setDoc(doc(anon(), 'members/m2'), { fullName: 'Injected' }))
      await assertFails(setDoc(doc(signedIn(), 'members/m2'), { fullName: 'Injected' }))
      await assertFails(deleteDoc(doc(anon(), 'members/m1')))
    })

    it('can be published and removed by a moderator', async () => {
      await assertSucceeds(setDoc(doc(admin(), 'members/m2'), { fullName: 'Approved Person' }))
      await assertSucceeds(deleteDoc(doc(admin(), 'members/m1')))
    })
  })

  describe('everything else', () => {
    it('denies access to undeclared collections', async () => {
      await assertFails(setDoc(doc(anon(), 'secrets/x'), { a: 1 }))
      await assertFails(getDoc(doc(anon(), 'secrets/x')))
      await assertFails(setDoc(doc(admin(), 'secrets/x'), { a: 1 }))
    })
  })
})

describe.skipIf(available)('firestore.rules (emulator not running)', () => {
  it('is skipped — start the emulator and run npm run test:rules', () => {
    expect(available).toBe(false)
  })
})
