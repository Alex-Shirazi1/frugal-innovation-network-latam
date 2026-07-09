/**
 * RELIF prototype API. Serves all site content plus the member-intake
 * pipeline. This server NEVER talks to the live redinnovacionfrugal.lat
 * host — it is the future replacement for it.
 *
 * Every response uses the { success, data, error } envelope.
 */
import { readFileSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { validateIntake } from './validate.mjs'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'data')
const readJson = (name) => JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'))

const seedMembers = readJson('members')
const institutions = readJson('institutions')
const resources = readJson('resources')
const conference = readJson('conference')
const onboardingOptions = readJson('onboarding-options')

const ok = (data) => ({ success: true, data, error: null })
const err = (error) => ({ success: false, data: null, error })

const DEV_ADMIN_KEY = 'relif-dev-admin'

function getAdminKey() {
  const key = process.env.ADMIN_KEY
  if (key) return key
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_KEY must be set in production')
  }
  return DEV_ADMIN_KEY
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export function createApp(db) {
  const app = express()
  const adminKey = getAdminKey()
  if (adminKey === DEV_ADMIN_KEY) {
    console.warn('[relif-api] ADMIN_KEY not set — using the dev default. Never do this in production.')
  }

  app.use(cors())
  app.use(express.json({ limit: '50kb' }))

  // ---- Public content ----------------------------------------------------
  app.get('/api/health', (_req, res) => res.json(ok({ status: 'up' })))
  app.get('/api/institutions', (_req, res) => res.json(ok(institutions)))
  app.get('/api/resources', (_req, res) => res.json(ok(resources)))
  app.get('/api/conference', (_req, res) => res.json(ok(conference)))
  app.get('/api/onboarding-options', (_req, res) => res.json(ok(onboardingOptions)))

  // Directory = curated seed profiles + approved intake submissions.
  // Pending submissions are never exposed here.
  app.get('/api/members', (_req, res) =>
    res.json(ok([...db.listApprovedMembers(), ...seedMembers])),
  )

  // ---- Intake pipeline ---------------------------------------------------
  const intakeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: err('rate-limited'),
  })

  app.post('/api/members/intake', intakeLimiter, (req, res) => {
    // Honeypot: same trick production uses — bots fill the hidden phone field.
    if (typeof req.body?.phone === 'string' && req.body.phone !== '') {
      return res.status(400).json(err('missing-required'))
    }

    const result = validateIntake(req.body)
    if (!result.ok) {
      return res.status(400).json(err(result.error))
    }

    const record = db.insertIntake(result.member)
    return res.status(201).json(ok(record))
  })

  // ---- Admin (approval queue) ---------------------------------------------
  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: err('rate-limited'),
  })

  function requireAdmin(req, res, next) {
    if (!safeEqual(req.get('x-admin-key') ?? '', adminKey)) {
      return res.status(401).json(err('unauthorized'))
    }
    return next()
  }

  app.use('/api/admin', adminLimiter, requireAdmin)
  app.post('/api/admin/login', (_req, res) => res.json(ok({ authenticated: true })))
  app.get('/api/admin/pending', (_req, res) => res.json(ok(db.listPending())))

  app.post('/api/admin/members/:id/approve', (req, res) => {
    const record = db.approve(req.params.id)
    if (!record) return res.status(404).json(err('not-found'))
    return res.json(ok(record))
  })

  app.post('/api/admin/members/:id/reject', (req, res) => {
    if (!db.reject(req.params.id)) return res.status(404).json(err('not-found'))
    return res.json(ok({ id: req.params.id, rejected: true }))
  })

  // ---- Fallthrough ---------------------------------------------------------
  app.use('/api', (_req, res) => res.status(404).json(err('not-found')))

  return app
}
