import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.mjs'
import { openDb } from './db.mjs'

process.env.ADMIN_KEY = 'test-admin-key'
const ADMIN = { 'x-admin-key': 'test-admin-key' }

const validIntake = {
  fullName: 'Ana Prueba García',
  position: 'researcher',
  affiliationId: 'iteso',
  country: 'México',
  region: 'Jalisco',
  interestIds: ['salud', 'energia'],
  socialUrl: 'https://linkedin.com/in/ana-prueba',
  cvFileName: null,
}

let db
let app

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
    },
  )

  it('serves conference data with all sections', async () => {
    const res = await request(app).get('/api/conference')
    expect(Object.keys(res.body.data)).toEqual(
      expect.arrayContaining(['agendaDay1', 'agendaDay2', 'speakers', 'conferenceVideos', 'galleryTiles']),
    )
  })

  it('serves the 54 seed members', async () => {
    const res = await request(app).get('/api/members')
    expect(res.body.data).toHaveLength(54)
  })

  it('404s unknown API routes with the envelope', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not-found')
  })
})

describe('intake pipeline', () => {
  it('accepts a valid submission as pending', async () => {
    const res = await request(app).post('/api/members/intake').send(validIntake)
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.title).toBe('Investigador/a')
    expect(res.body.data.interestIds).toEqual(['salud', 'energia'])
  })

  it('does not expose pending members in the public directory', async () => {
    await request(app).post('/api/members/intake').send(validIntake)
    const res = await request(app).get('/api/members')
    expect(res.body.data).toHaveLength(54)
  })

  it.each([
    ['missing name', { ...validIntake, fullName: '  ' }, 'missing-required'],
    ['bad position', { ...validIntake, position: 'ceo' }, 'missing-required'],
    ['region not in country', { ...validIntake, region: 'Lima' }, 'invalid-location'],
    ['unknown affiliation', { ...validIntake, affiliationId: 'hogwarts' }, 'invalid-affiliation'],
    ['no valid interests', { ...validIntake, interestIds: ['x'] }, 'missing-interests'],
    ['bad url', { ...validIntake, socialUrl: 'not a url' }, 'invalid-url'],
  ])('rejects %s', async (_label, payload, code) => {
    const res = await request(app).post('/api/members/intake').send(payload)
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(code)
  })

  it('rejects honeypot submissions', async () => {
    const res = await request(app)
      .post('/api/members/intake')
      .send({ ...validIntake, phone: '555-BOT' })
    expect(res.status).toBe(400)
  })
})

describe('admin approval queue', () => {
  it('rejects requests without the admin key', async () => {
    for (const call of [
      request(app).get('/api/admin/pending'),
      request(app).post('/api/admin/login'),
      request(app).post('/api/admin/members/x/approve'),
    ]) {
      const res = await call
      expect(res.status).toBe(401)
    }
  })

  it('rejects a wrong admin key', async () => {
    const res = await request(app).get('/api/admin/pending').set('x-admin-key', 'wrong')
    expect(res.status).toBe(401)
  })

  it('lists pending submissions for the admin', async () => {
    await request(app).post('/api/members/intake').send(validIntake)
    const res = await request(app).get('/api/admin/pending').set(ADMIN)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].fullName).toBe('Ana Prueba García')
  })

  it('approve publishes the member to the public directory', async () => {
    const intake = await request(app).post('/api/members/intake').send(validIntake)
    const id = intake.body.data.id

    const approve = await request(app).post(`/api/admin/members/${id}/approve`).set(ADMIN)
    expect(approve.status).toBe(200)
    expect(approve.body.data.status).toBe('approved')

    const members = await request(app).get('/api/members')
    expect(members.body.data).toHaveLength(55)
    expect(members.body.data[0].fullName).toBe('Ana Prueba García')

    const pending = await request(app).get('/api/admin/pending').set(ADMIN)
    expect(pending.body.data).toHaveLength(0)
  })

  it('reject removes the submission entirely', async () => {
    const intake = await request(app).post('/api/members/intake').send(validIntake)
    const id = intake.body.data.id

    const reject = await request(app).post(`/api/admin/members/${id}/reject`).set(ADMIN)
    expect(reject.status).toBe(200)

    const members = await request(app).get('/api/members')
    expect(members.body.data).toHaveLength(54)
  })

  it('404s approve/reject for unknown ids', async () => {
    const res = await request(app).post('/api/admin/members/ghost/approve').set(ADMIN)
    expect(res.status).toBe(404)
  })
})
