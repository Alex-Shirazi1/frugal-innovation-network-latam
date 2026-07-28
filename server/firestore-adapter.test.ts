/**
 * Tests the Firestore adapter and the moderation flow against the emulator.
 *
 * The rules tests prove the rules refuse what they should. These prove the
 * application code on top of them actually works — document shaping, the
 * submissions -> members copy on approve, and the derived fields. Because the
 * adapter runs through a real rules-enforced Firestore handle, adapter and
 * rules are verified together rather than in isolation.
 *
 * Skipped when the emulator is not running. Run with: npm run test:rules
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import type { Firestore } from 'firebase/firestore'

const HOST = '127.0.0.1'
const PORT = 8080

/**
 * Which Firestore handle the mocked `getDb` hands back. Swapped per test so the
 * same adapter code runs as an anonymous visitor or as a claim-bearing admin.
 */
const handle: { db: Firestore | null } = { db: null }

vi.mock('../src/lib/firebase', () => ({
  readFirebaseConfig: () => ({
    apiKey: 'test',
    authDomain: 'test.firebaseapp.com',
    projectId: 'relif-adapter-test',
    appId: 'test',
  }),
  getDb: async () => {
    if (!handle.db) throw new Error('test handle not set')
    return handle.db
  },
  getAuthClient: async () => {
    throw new Error('auth not exercised in these tests')
  },
}))

async function emulatorRunning(): Promise<boolean> {
  try {
    await fetch(`http://${HOST}:${PORT}/`, { signal: AbortSignal.timeout(1500) })
    return true
  } catch {
    return false
  }
}

const available = await emulatorRunning()

let testEnv: RulesTestEnvironment | undefined

// Imported after the mock is registered so the adapter picks up the fake getDb.
const { createFirestoreDataSource } = await import('../src/api/adapters/firestore')
const { adminApi } = await import('../src/api/adminApi')
const { makeSubmission } = await import('../src/test/fixtures')

const config = {
  apiKey: 'test',
  authDomain: 'test.firebaseapp.com',
  projectId: 'relif-adapter-test',
  appId: 'test',
}

describe.skipIf(!available)('Firestore adapter', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'relif-adapter-test',
      firestore: { host: HOST, port: PORT, rules: readFileSync('firestore.rules', 'utf8') },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv?.clearFirestore()
    handle.db = testEnv!.unauthenticatedContext().firestore() as unknown as Firestore
  })

  const asAdmin = () => {
    handle.db = testEnv!
      .authenticatedContext('allan', { admin: true })
      .firestore() as unknown as Firestore
  }
  const asAnon = () => {
    handle.db = testEnv!.unauthenticatedContext().firestore() as unknown as Firestore
  }

  describe('submitIntake', () => {
    it('stores a valid submission and reports it persisted', async () => {
      const source = createFirestoreDataSource(config)
      const result = await source.submitIntake(makeSubmission())

      expect(result.success).toBe(true)
      // The whole point of the flag: this one really was written.
      expect(result.persisted).toBe(true)
      expect(result.data?.fullName).toBe('Ana Prueba García')
      expect(result.data?.id).toBeTruthy()
    })

    it('writes exactly the fields the rules allow, with a derived pending status', async () => {
      const source = createFirestoreDataSource(config)
      await source.submitIntake(makeSubmission())

      asAdmin()
      const pending = await adminApi.listPending()
      expect(pending).toHaveLength(1)
      const entry = pending[0]
      expect(entry.status).toBe('pending')
      expect(entry.firstName).toBe('Ana')
      expect(entry.lastName).toBe('Prueba García')
      expect(entry.jobPositionName).toBe('Investigadora Asociada')
      expect(entry.biography).toContain('salud comunitaria')
      expect(entry.generalAreaIds).toEqual(['ingenieria'])
      expect(entry.languages).toEqual(['es', 'en'])
      expect(entry.region).toBe('Jalisco')
      expect(entry.createdAt).toBeTruthy()
    })

    it('derives the localized title rather than trusting the client', async () => {
      const source = createFirestoreDataSource(config)
      await source.submitIntake(makeSubmission({ position: 'faculty' }))

      asAdmin()
      const [entry] = await adminApi.listPending()
      expect(entry.title).toEqual({ es: 'Docente', en: 'Faculty', pt: 'Docente' })
    })

    it('rejects an invalid submission locally without writing anything', async () => {
      const source = createFirestoreDataSource(config)
      const result = await source.submitIntake(makeSubmission({ consentToPublish: false }))

      expect(result.success).toBe(false)
      expect(result.error).toBe('consent-required')
      expect(result.persisted).toBe(false)

      asAdmin()
      expect(await adminApi.listPending()).toHaveLength(0)
    })

    it.each([
      ['region outside the country', { region: 'Lima' }, 'invalid-location'],
      ['unknown affiliation', { affiliationId: 'nope' }, 'invalid-affiliation'],
      ['no languages', { languages: [] }, 'missing-languages'],
      ['no general areas', { generalAreaIds: [] }, 'missing-areas'],
      ['blank name', { firstName: ' ' }, 'missing-required'],
    ])('refuses %s', async (_label, patch, code) => {
      const source = createFirestoreDataSource(config)
      const result = await source.submitIntake(makeSubmission(patch))
      expect(result.error).toBe(code)
      expect(result.persisted).toBe(false)
    })
  })

  describe('getMembers', () => {
    it('returns the bundled seed directory when nothing is approved', async () => {
      const source = createFirestoreDataSource(config)
      const members = await source.getMembers()
      expect(members).toHaveLength(54)
    })

    it('puts approved records ahead of the seed directory', async () => {
      const source = createFirestoreDataSource(config)
      await source.submitIntake(makeSubmission())

      asAdmin()
      const [entry] = await adminApi.listPending()
      await adminApi.approve(entry.id)

      asAnon()
      const members = await source.getMembers()
      expect(members).toHaveLength(55)
      expect(members[0].fullName).toBe('Ana Prueba García')
    })

    it('never exposes a pending submission through the public directory', async () => {
      const source = createFirestoreDataSource(config)
      await source.submitIntake(makeSubmission())

      const members = await source.getMembers()
      expect(members).toHaveLength(54)
      expect(members.some((m) => m.fullName === 'Ana Prueba García')).toBe(false)
    })
  })

  describe('moderation', () => {
    async function seedPending() {
      asAnon()
      await createFirestoreDataSource(config).submitIntake(makeSubmission())
      asAdmin()
      const [entry] = await adminApi.listPending()
      return entry
    }

    it('approve publishes the member and clears the queue entry', async () => {
      const entry = await seedPending()
      await adminApi.approve(entry.id)

      expect(await adminApi.listPending()).toHaveLength(0)

      asAnon()
      const members = await createFirestoreDataSource(config).getMembers()
      const published = members.find((m) => m.fullName === 'Ana Prueba García')
      expect(published).toBeDefined()
      expect(published?.biography).toContain('salud comunitaria')
      expect(published?.languages).toEqual(['es', 'en'])
    })

    /** consentToPublish is an intake gate; it must not leak into the public record. */
    it('does not copy intake-only bookkeeping into the published record', async () => {
      const entry = await seedPending()
      await adminApi.approve(entry.id)

      asAnon()
      const members = await createFirestoreDataSource(config).getMembers()
      const published = members.find((m) => m.fullName === 'Ana Prueba García')
      expect(published).toBeDefined()
      expect(published as unknown as Record<string, unknown>).not.toHaveProperty('consentToPublish')
      expect(published as unknown as Record<string, unknown>).not.toHaveProperty('status')
      expect(published as unknown as Record<string, unknown>).not.toHaveProperty('createdAt')
    })

    it('derives avatarHue deterministically on publish', async () => {
      const entry = await seedPending()
      await adminApi.approve(entry.id)

      asAnon()
      const members = await createFirestoreDataSource(config).getMembers()
      const published = members.find((m) => m.fullName === 'Ana Prueba García')
      expect(published?.avatarHue).toBeGreaterThanOrEqual(0)
      expect(published?.avatarHue).toBeLessThan(360)
    })

    it('reject removes the submission and publishes nothing', async () => {
      const entry = await seedPending()
      await adminApi.reject(entry.id)

      expect(await adminApi.listPending()).toHaveLength(0)

      asAnon()
      const members = await createFirestoreDataSource(config).getMembers()
      expect(members).toHaveLength(54)
    })

    it('approving an unknown id fails instead of publishing an empty record', async () => {
      asAdmin()
      await expect(adminApi.approve('does-not-exist')).rejects.toThrow('not-found')

      asAnon()
      expect(await createFirestoreDataSource(config).getMembers()).toHaveLength(54)
    })

    /** The rules enforce this, but the adapter must surface it as a failure. */
    it('refuses moderation for a caller without the admin claim', async () => {
      await seedPending()
      handle.db = testEnv!.authenticatedContext('random').firestore() as unknown as Firestore

      await expect(adminApi.listPending()).rejects.toThrow()
    })

    it('refuses moderation for an anonymous caller', async () => {
      const entry = await seedPending()
      asAnon()
      await expect(adminApi.listPending()).rejects.toThrow()
      await expect(adminApi.approve(entry.id)).rejects.toThrow()
      await expect(adminApi.reject(entry.id)).rejects.toThrow()
    })

    it('orders the queue oldest first so moderation is fair', async () => {
      asAnon()
      const source = createFirestoreDataSource(config)
      await source.submitIntake(makeSubmission({ firstName: 'First' }))
      await source.submitIntake(makeSubmission({ firstName: 'Second' }))
      await source.submitIntake(makeSubmission({ firstName: 'Third' }))

      asAdmin()
      const pending = await adminApi.listPending()
      expect(pending.map((p) => p.firstName)).toEqual(['First', 'Second', 'Third'])
    })
  })

  describe('content reads', () => {
    /** Site content is code-managed; Firestore is not consulted for it. */
    it('serves institutions, resources, conference and options from the bundle', async () => {
      const source = createFirestoreDataSource(config)
      expect((await source.getInstitutions()).length).toBeGreaterThan(30)
      expect((await source.getResources()).length).toBeGreaterThan(0)
      expect(Object.keys(await source.getConference())).toEqual(
        expect.arrayContaining(['agendaDay1', 'agendaDay2', 'speakers', 'conferenceVideos', 'galleryTiles']),
      )
      const options = await source.getOnboardingOptions()
      expect(options.generalAreas.length).toBeGreaterThan(0)
      expect(options.languageOptions.length).toBeGreaterThan(0)
    })
  })
})

describe.skipIf(available)('Firestore adapter (emulator not running)', () => {
  it('is skipped — start the emulator and run npm run test:rules', () => {
    expect(available).toBe(false)
  })
})
