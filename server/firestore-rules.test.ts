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
  const payload: Record<string, unknown> = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada.lovelace@example.org',
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
  /*
   * An override of `undefined` means "omit this field", not "send undefined".
   * The Firestore SDK throws on undefined values, so leaving them in would make
   * an assertFails pass because the client rejected the write — never reaching
   * the rules, which is the thing under test.
   */
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) delete payload[key]
  }
  return payload
}

/**
 * A published directory record that satisfies every clause of validMember —
 * the output shape of toPublishedMember in src/api/adminApi.ts.
 */
function validMember(overrides: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    title: { es: 'Investigadora', en: 'Researcher', pt: 'Pesquisadora' },
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
    avatarHue: 210,
    ...overrides,
  }
  // Same omit-on-undefined contract as validSubmission above.
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) delete payload[key]
  }
  return payload
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
  /** The Apps Script transport: deposits form responses, and can do nothing else. */
  const importer = () => testEnv!.authenticatedContext('transport', { importer: true }).firestore()

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
      // The rules are the only email check a client cannot skip, so they carry
      // the same weight here as the taxonomy whitelists above.
      ['missing email', { email: undefined }],
      ['blank email', { email: '' }],
      ['email with no at sign', { email: 'ada.example.org' }],
      ['email with no domain dot', { email: 'ada@example' }],
      ['email with a space', { email: 'ada lovelace@example.org' }],
      ['numeric email', { email: 42 }],
      ['overlong email', { email: `${'a'.repeat(250)}@example.org` }],
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

  describe('formResponses — the incorporation-form transport', () => {
    const response = (overrides: Record<string, unknown> = {}) => ({
      answers: { Nombre: 'Ada', Apellido: 'Lovelace', 'Correo electrónico': 'ada@example.org' },
      receivedAt: '2026-08-11T21:04:12.000Z',
      ...overrides,
    })

    it('accepts a deposit from the transport account', async () => {
      await assertSucceeds(addDoc(collection(importer(), 'formResponses'), response()))
    })

    it('refuses deposits from the public or a plain signed-in user', async () => {
      await assertFails(addDoc(collection(anon(), 'formResponses'), response()))
      await assertFails(addDoc(collection(signedIn(), 'formResponses'), response()))
    })

    /*
     * Least privilege, and the reason importer is a separate claim from admin: a
     * leaked transport password must not expose the applicants already collected.
     */
    it('does not let the transport read back what it deposited', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'formResponses/f1'), response())
      })
      await assertFails(getDoc(doc(importer(), 'formResponses/f1')))
      await assertFails(getDocs(collection(importer(), 'formResponses')))
    })

    it('does not let the transport publish anyone to the directory', async () => {
      await assertFails(setDoc(doc(importer(), 'members/m9'), validMember()))
    })

    it('never exposes an applicant response to the public', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'formResponses/f1'), response())
      })
      await assertFails(getDoc(doc(anon(), 'formResponses/f1')))
      await assertFails(getDoc(doc(signedIn(), 'formResponses/f1')))
    })

    it('lets a moderator read and clear responses', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'formResponses/f1'), response())
      })
      await assertSucceeds(getDoc(doc(admin(), 'formResponses/f1')))
      await assertSucceeds(deleteDoc(doc(admin(), 'formResponses/f1')))
    })

    it('refuses a rewrite of a response, by anyone', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'formResponses/f1'), response())
      })
      // A response records what somebody actually submitted; editing it is not a
      // capability this collection has, for the transport or for a moderator.
      await assertFails(setDoc(doc(importer(), 'formResponses/f1'), response()))
      await assertFails(setDoc(doc(admin(), 'formResponses/f1'), response()))
    })

    it('bounds what an authenticated transport can deposit', async () => {
      const tooMany: Record<string, string> = {}
      for (let i = 0; i < 41; i += 1) tooMany[`Pregunta ${i}`] = 'x'
      await assertFails(addDoc(collection(importer(), 'formResponses'), response({ answers: tooMany })))
      await assertFails(addDoc(collection(importer(), 'formResponses'), response({ answers: {} })))
      await assertFails(
        addDoc(collection(importer(), 'formResponses'), response({ extra: 'unexpected' })),
      )
      await assertFails(addDoc(collection(importer(), 'formResponses'), response({ receivedAt: '' })))
    })
  })

  describe('members — published directory', () => {
    beforeEach(async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'members/m1'), validMember())
      })
    })

    it('is readable by anyone', async () => {
      await assertSucceeds(getDoc(doc(anon(), 'members/m1')))
      await assertSucceeds(getDocs(collection(anon(), 'members')))
    })

    it('cannot be written by the public or by a plain signed-in user', async () => {
      await assertFails(setDoc(doc(anon(), 'members/m2'), validMember()))
      await assertFails(setDoc(doc(signedIn(), 'members/m2'), validMember()))
      await assertFails(deleteDoc(doc(anon(), 'members/m1')))
    })

    it('can be published and removed by a moderator', async () => {
      await assertSucceeds(setDoc(doc(admin(), 'members/m2'), validMember()))
      await assertSucceeds(deleteDoc(doc(admin(), 'members/m1')))
    })

    /*
     * The reason validMember exists. `members` is the one world-readable
     * collection, so an address stored here is an address on the open web —
     * and a moderator session is precisely what a compromised account has.
     */
    it('refuses an email address even from a moderator', async () => {
      await assertFails(
        setDoc(doc(admin(), 'members/m2'), validMember({ email: 'ada.lovelace@example.org' })),
      )
    })

    it('refuses queue bookkeeping on a published record', async () => {
      for (const extra of [
        { status: 'approved' },
        { consentToPublish: true },
        { createdAt: '2026-07-28T00:00:00.000Z' },
      ]) {
        await assertFails(setDoc(doc(admin(), 'members/m2'), validMember(extra)))
      }
    })

    // Display identity is derived by the approval path, so anything malformed
    // here means the write did not come from it.
    it('refuses a forged or malformed display identity', async () => {
      for (const bad of [
        { title: 'Researcher' },
        { title: { es: 'Investigadora' } },
        { fullName: '' },
        { avatarHue: 400 },
        { avatarHue: 1.5 },
        { position: 'director' },
      ]) {
        await assertFails(setDoc(doc(admin(), 'members/m2'), validMember(bad)))
      }
    })

    it('still refuses an unknown region or affiliation', async () => {
      await assertFails(setDoc(doc(admin(), 'members/m2'), validMember({ region: 'Atlantis' })))
      await assertFails(
        setDoc(doc(admin(), 'members/m2'), validMember({ affiliationId: 'not-a-university' })),
      )
    })

    /*
     * publishedAt answers "when did this person appear", which createdAt cannot:
     * createdAt is queue bookkeeping and stays rejected on a published record.
     */
    it('accepts a publication date, and still refuses queue bookkeeping', async () => {
      await assertSucceeds(
        setDoc(
          doc(admin(), 'members/m2'),
          validMember({ publishedAt: '2026-08-11T21:30:00.000Z' }),
        ),
      )
      await assertFails(
        setDoc(doc(admin(), 'members/m3'), validMember({ createdAt: '2026-08-11T21:30:00.000Z' })),
      )
    })

    it('refuses a publication date that is empty or absurdly long', async () => {
      await assertFails(setDoc(doc(admin(), 'members/m2'), validMember({ publishedAt: '' })))
      await assertFails(
        setDoc(doc(admin(), 'members/m2'), validMember({ publishedAt: 'x'.repeat(41) })),
      )
    })

    it('accepts a record that omits every optional field', async () => {
      await assertSucceeds(
        setDoc(
          doc(admin(), 'members/m2'),
          validMember({
            jobPositionName: undefined,
            biography: undefined,
            socialUrl: undefined,
            affiliationId: undefined,
          }),
        ),
      )
    })
  })

  describe('editable site content', () => {
    const initiative = (overrides: Record<string, unknown> = {}) => {
      const payload: Record<string, unknown> = {
        order: 0,
        title: { es: 'Encuentros anuales', en: 'Annual gatherings' },
        text: { es: 'Congresos y encuentros de la comunidad frugal.' },
        url: 'https://example.org/encuentros',
        cta: { es: 'Ver más' },
        ...overrides,
      }
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined) delete payload[key]
      }
      return payload
    }

    const entry = (overrides: Record<string, unknown> = {}) => {
      const payload: Record<string, unknown> = {
        paperNumber: '001',
        title: 'Frugal innovation in practice',
        authors: 'Prabhu, J.',
        year: 2020,
        language: 'EN',
        file: '/docs/biblio/001.pdf',
        sizeKb: 420,
        ...overrides,
      }
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined) delete payload[key]
      }
      return payload
    }

    it('is readable by anyone — it is site content, not personal data', async () => {
      await assertSucceeds(getDoc(doc(anon(), 'initiatives/encuentros')))
      await assertSucceeds(getDoc(doc(anon(), 'bibliography/biblio-001')))
    })

    const congress = (overrides: Record<string, unknown> = {}) => ({
      kicker: { es: 'Congreso' },
      title: { es: 'Mundos de Transformación' },
      subtitle: { es: 'Innovaciones para la justicia social y ambiental' },
      details: { es: 'Tres días de trabajo en San Salvador.' },
      siteCta: { es: 'Ver el sitio del congreso' },
      siteUrl: 'https://example.org/congreso',
      ...overrides,
    })

    const resource = (overrides: Record<string, unknown> = {}) => ({
      title: { es: 'Marco RELIF' },
      language: 'ES',
      type: 'PDF',
      file: '/docs/marco-relif.pdf',
      ...overrides,
    })

    it('is readable by anyone — it is site content, not personal data', async () => {
      await assertSucceeds(getDoc(doc(anon(), 'initiatives/encuentros')))
      await assertSucceeds(getDoc(doc(anon(), 'bibliography/biblio-001')))
      await assertSucceeds(getDoc(doc(anon(), 'siteContent/congress')))
      await assertSucceeds(getDoc(doc(anon(), 'resources/r1')))
    })

    /*
     * Every editable collection, not a sample of them. The congress document and
     * the resources table were previously only covered on the admin path, so
     * nothing would have caught a rule that let the public write them.
     */
    it('cannot be written by the public or by a plain signed-in user', async () => {
      await assertFails(setDoc(doc(anon(), 'initiatives/x'), initiative()))
      await assertFails(setDoc(doc(signedIn(), 'initiatives/x'), initiative()))
      await assertFails(setDoc(doc(anon(), 'bibliography/x'), entry()))
      await assertFails(setDoc(doc(signedIn(), 'bibliography/x'), entry()))
      await assertFails(setDoc(doc(anon(), 'siteContent/congress'), congress()))
      await assertFails(setDoc(doc(signedIn(), 'siteContent/congress'), congress()))
      await assertFails(setDoc(doc(anon(), 'resources/x'), resource()))
      await assertFails(setDoc(doc(signedIn(), 'resources/x'), resource()))
      await assertFails(deleteDoc(doc(signedIn(), 'initiatives/x')))
      await assertFails(deleteDoc(doc(signedIn(), 'siteContent/congress')))
      await assertFails(deleteDoc(doc(signedIn(), 'resources/x')))
    })

    it('lets a moderator write the congress document and the resources table', async () => {
      await assertSucceeds(setDoc(doc(admin(), 'siteContent/congress'), congress()))
      await assertSucceeds(setDoc(doc(admin(), 'resources/x'), resource()))
      // The delete split added alongside validMember — a delete carries no
      // request.resource, so it must not be gated on a shape check.
      await assertSucceeds(deleteDoc(doc(admin(), 'siteContent/congress')))
      await assertSucceeds(deleteDoc(doc(admin(), 'resources/x')))
    })

    it('can be created, edited and deleted by a moderator', async () => {
      await assertSucceeds(setDoc(doc(admin(), 'initiatives/x'), initiative()))
      await assertSucceeds(setDoc(doc(admin(), 'initiatives/x'), initiative({ order: 3 })))
      await assertSucceeds(deleteDoc(doc(admin(), 'initiatives/x')))
      await assertSucceeds(setDoc(doc(admin(), 'bibliography/x'), entry()))
      await assertSucceeds(deleteDoc(doc(admin(), 'bibliography/x')))
    })

    /**
     * Shape is validated even for admins. A typo in the dashboard should not be
     * able to store a document the public renderer cannot read — the section
     * would break for every visitor, and the rules are the last place that can
     * still say no.
     */
    it.each([
      ['no Spanish title', { title: { en: 'English only' } }],
      ['blank Spanish title', { title: { es: '' } }],
      ['title that is not a map', { title: 'Encuentros' }],
      ['unexpected language key', { title: { es: 'Hola', fr: 'Bonjour' } }],
      ['missing description', { text: undefined }],
      ['non-integer order', { order: 1.5 }],
      ['javascript: url', { url: 'javascript:alert(1)' }],
      ['unknown field', { rogue: true }],
    ])('rejects an initiative with %s, even from a moderator', async (_label, patch) => {
      await assertFails(setDoc(doc(admin(), 'initiatives/x'), initiative(patch)))
    })

    it.each([
      ['no title', { title: '' }],
      ['no paper number', { paperNumber: undefined }],
      ['no file', { file: undefined }],
      ['an unsupported language', { language: 'FR' }],
      ['a non-numeric year', { year: 'dos mil veinte' }],
      ['an unknown field', { rogue: true }],
    ])('rejects a bibliography entry with %s, even from a moderator', async (_label, patch) => {
      await assertFails(setDoc(doc(admin(), 'bibliography/x'), entry(patch)))
    })

    it('accepts an entry with no year, since some documents do not state one', async () => {
      await assertSucceeds(setDoc(doc(admin(), 'bibliography/x'), entry({ year: null })))
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
