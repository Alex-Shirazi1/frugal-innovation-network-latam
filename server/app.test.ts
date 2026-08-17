import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app'
import { openDb, type IntakeDb } from './db'
import type { IntakeSubmission } from '../src/domain/intake'
import { seedMembers } from '../src/data/members'

process.env.ADMIN_KEY = 'test-admin-key'
const ADMIN = { 'x-admin-key': 'test-admin-key' }

const validIntake: IntakeSubmission = {
  fullName: 'Ana Prueba García',
  email: 'ana.prueba@example.org',
  position: 'researcher',
  jobPositionName: 'Investigadora Asociada',
  biography: 'Trabaja en salud comunitaria y energía asequible.',
  affiliationId: 'iteso',
  country: 'México',
  region: 'Jalisco',
  interestIds: ['salud', 'energia'],
  generalAreaIds: ['ingenieria'],
  languages: ['es', 'en'],
  socialUrl: 'https://linkedin.com/in/ana-prueba',
  consentToPublish: true,
}

let db: IntakeDb
let app: ReturnType<typeof createApp>

beforeEach(() => {
  db = openDb(':memory:')
  app = createApp(db)
})

afterEach(() => {
  db.close()
})

describe('public content endpoints', () => {
  it('reports healthy', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { status: 'up' }, error: null })
  })

  it.each(['institutions', 'resources', 'onboarding-options'])(
    'serves %s in the envelope',
    async (name) => {
      const res = await request(app).get(`/api/${name}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.error).toBeNull()
      expect(res.body.data).toBeTruthy()
    },
  )

  it('serves conference data with all sections', async () => {
    const res = await request(app).get('/api/conference')
    expect(Object.keys(res.body.data)).toEqual(
      expect.arrayContaining(['speakers', 'annualMeetingVideos']),
    )
  })

  it('serves the seed members', async () => {
    const res = await request(app).get('/api/members')
    expect(res.body.data).toHaveLength(seedMembers.length)
  })

  it('404s unknown API routes with the envelope', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, data: null, error: 'not-found' })
  })
})

describe('intake pipeline', () => {
  it('accepts a valid submission as pending', async () => {
    const res = await request(app).post('/api/members/intake').send(validIntake)
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.fullName).toBe('Ana Prueba García')
    expect(res.body.data.title).toEqual({
      es: 'Investigador/a',
      en: 'Researcher',
      pt: 'Pesquisador/a',
    })
  })

  it('persists every field Allan asked for', async () => {
    const res = await request(app).post('/api/members/intake').send(validIntake)
    const m = res.body.data
    expect(m.fullName).toBe('Ana Prueba García')
    expect(m.jobPositionName).toBe('Investigadora Asociada')
    expect(m.biography).toContain('salud comunitaria')
    expect(m.generalAreaIds).toEqual(['ingenieria'])
    expect(m.languages).toEqual(['es', 'en'])
    expect(m.region).toBe('Jalisco')
  })

  it('does not expose pending members in the public directory', async () => {
    await request(app).post('/api/members/intake').send(validIntake)
    const res = await request(app).get('/api/members')
    expect(res.body.data).toHaveLength(seedMembers.length)
    expect(res.body.data.some((m: { fullName: string }) => m.fullName === 'Ana Prueba García')).toBe(
      false,
    )
  })

  it.each([
    ['blank name', { fullName: '  ' }, 'missing-required'],
    ['unknown position', { position: 'hacker' }, 'missing-required'],
    ['region not in country', { region: 'Lima' }, 'invalid-location'],
    ['unknown country', { country: 'Atlantis' }, 'invalid-location'],
    ['unknown affiliation', { affiliationId: 'nope' }, 'invalid-affiliation'],
    ['no valid interests', { interestIds: ['bogus'] }, 'missing-interests'],
    ['no general areas', { generalAreaIds: [] }, 'missing-areas'],
    ['no languages', { languages: [] }, 'missing-languages'],
    ['javascript: url', { socialUrl: 'javascript:alert(1)' }, 'invalid-url'],
    ['consent withheld', { consentToPublish: false }, 'consent-required'],
    ['overlong biography', { biography: 'x'.repeat(801) }, 'too-long'],
    ['overlong name', { fullName: 'x'.repeat(142) }, 'too-long'],
  ])('rejects %s', async (_label, patch, code) => {
    const res = await request(app)
      .post('/api/members/intake')
      .send({ ...validIntake, ...patch })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(code)
  })

  it('rejects honeypot submissions', async () => {
    const res = await request(app)
      .post('/api/members/intake')
      .send({ ...validIntake, phone: '555-1234' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('missing-required')
  })

  it('ignores client-supplied fields the server owns', async () => {
    const res = await request(app)
      .post('/api/members/intake')
      .send({ ...validIntake, id: 'forged', status: 'approved', avatarHue: 999, title: { es: 'x', en: 'x', pt: 'x' } })
    expect(res.status).toBe(201)
    expect(res.body.data.id).not.toBe('forged')
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.avatarHue).toBeLessThan(360)
    expect(res.body.data.title.en).toBe('Researcher')
  })
})

describe('admin approval queue', () => {
  it('rejects requests without the admin key', async () => {
    for (const call of [
      request(app).get('/api/admin/pending'),
      request(app).post('/api/admin/members/x/approve'),
      request(app).post('/api/admin/members/x/reject'),
    ]) {
      const res = await call
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('unauthorized')
    }
  })

  it('rejects a wrong admin key', async () => {
    const res = await request(app).get('/api/admin/pending').set({ 'x-admin-key': 'nope' })
    expect(res.status).toBe(401)
  })

  it('lists pending submissions for the admin', async () => {
    await request(app).post('/api/members/intake').send(validIntake)
    const res = await request(app).get('/api/admin/pending').set(ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].status).toBe('pending')
  })

  it('approve publishes the member to the public directory', async () => {
    const created = await request(app).post('/api/members/intake').send(validIntake)
    const id = created.body.data.id

    const approved = await request(app).post(`/api/admin/members/${id}/approve`).set(ADMIN)
    expect(approved.status).toBe(200)
    expect(approved.body.data.status).toBe('approved')

    const members = await request(app).get('/api/members')
    expect(members.body.data).toHaveLength(seedMembers.length + 1)
    expect(members.body.data.some((m: { fullName: string }) => m.fullName === 'Ana Prueba García')).toBe(
      true,
    )

    const queue = await request(app).get('/api/admin/pending').set(ADMIN)
    expect(queue.body.data).toHaveLength(0)
  })

  /**
   * `/api/members` is the public directory. An applicant consents to their
   * name, affiliation and interests being published — not to their address
   * being on the open web, which is a different promise entirely.
   */
  it('never exposes an applicant email on the public directory', async () => {
    const created = await request(app).post('/api/members/intake').send(validIntake)
    await request(app).post(`/api/admin/members/${created.body.data.id}/approve`).set(ADMIN)

    const members = await request(app).get('/api/members')
    const published = members.body.data.find(
      (m: { fullName: string }) => m.fullName === 'Ana Prueba García',
    )
    expect(published).toBeDefined()
    expect(published).not.toHaveProperty('email')
    // Belt and braces: the address must not appear anywhere in the payload,
    // including on a field nobody thought to check.
    expect(JSON.stringify(members.body.data)).not.toContain('ana.prueba@example.org')
  })

  it('does show the email on the moderation queue, which is admin-only', async () => {
    await request(app).post('/api/members/intake').send(validIntake)
    const queue = await request(app).get('/api/admin/pending').set(ADMIN)
    expect(queue.body.data[0].email).toBe('ana.prueba@example.org')
  })

  it('rejects a submission with no reply address', async () => {
    const { email: _dropped, ...withoutEmail } = validIntake
    const response = await request(app).post('/api/members/intake').send(withoutEmail)
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('missing-required')
  })

  it('reject removes the submission entirely', async () => {
    const created = await request(app).post('/api/members/intake').send(validIntake)
    const id = created.body.data.id

    const rejected = await request(app).post(`/api/admin/members/${id}/reject`).set(ADMIN)
    expect(rejected.status).toBe(200)
    expect(rejected.body.data).toEqual({ id, rejected: true })

    const queue = await request(app).get('/api/admin/pending').set(ADMIN)
    expect(queue.body.data).toHaveLength(0)
    const members = await request(app).get('/api/members')
    expect(members.body.data).toHaveLength(seedMembers.length)
  })

  it('404s approve/reject for unknown ids', async () => {
    for (const action of ['approve', 'reject']) {
      const res = await request(app).post(`/api/admin/members/missing/${action}`).set(ADMIN)
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('not-found')
    }
  })

  it('does not double-publish on repeat approval', async () => {
    const created = await request(app).post('/api/members/intake').send(validIntake)
    const id = created.body.data.id
    await request(app).post(`/api/admin/members/${id}/approve`).set(ADMIN)
    const second = await request(app).post(`/api/admin/members/${id}/approve`).set(ADMIN)
    expect(second.status).toBe(404)

    const members = await request(app).get('/api/members')
    expect(members.body.data).toHaveLength(seedMembers.length + 1)
  })
})
