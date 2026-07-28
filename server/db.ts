/**
 * SQLite persistence for intake submissions (node:sqlite, zero native deps).
 * Seed/content data stays in server/data/*.json — the DB only holds records
 * created at runtime through the intake pipeline.
 *
 * This is the LOCAL DEVELOPMENT backend. Production uses the Firestore
 * adapter (src/api/adapters/firestore.ts); see docs/DEPLOYMENT.md.
 */
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { Member } from '../src/data/members'
import type { ValidatedIntake } from '../src/domain/intake'

/** DDL applied at open. Static SQL only — no interpolation anywhere. */
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS intake_members (
     id TEXT PRIMARY KEY,
     first_name TEXT NOT NULL,
     last_name TEXT NOT NULL,
     full_name TEXT NOT NULL,
     title TEXT NOT NULL,
     position TEXT NOT NULL,
     job_position_name TEXT NOT NULL DEFAULT '',
     biography TEXT NOT NULL DEFAULT '',
     affiliation_id TEXT,
     country TEXT NOT NULL,
     region TEXT NOT NULL,
     interest_ids TEXT NOT NULL,
     general_area_ids TEXT NOT NULL DEFAULT '[]',
     languages TEXT NOT NULL DEFAULT '[]',
     social_url TEXT,
     avatar_hue INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_intake_members_status ON intake_members (status)`,
]

interface Row {
  id: string
  first_name: string
  last_name: string
  full_name: string
  title: string
  position: string
  job_position_name: string
  biography: string
  affiliation_id: string | null
  country: string
  region: string
  interest_ids: string
  general_area_ids: string
  languages: string
  social_url: string | null
  avatar_hue: number
  status: 'pending' | 'approved'
  created_at: string
}

export interface AdminEntry extends Member {
  status: 'pending' | 'approved'
  createdAt: string
}

/** Maps a DB row to the frontend Member shape (camelCase, parsed JSON). */
function rowToMember(row: Row): Member {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    title: JSON.parse(row.title),
    position: row.position as Member['position'],
    jobPositionName: row.job_position_name,
    biography: row.biography,
    affiliationId: row.affiliation_id ?? null,
    country: row.country,
    region: row.region,
    interestIds: JSON.parse(row.interest_ids),
    generalAreaIds: JSON.parse(row.general_area_ids),
    languages: JSON.parse(row.languages),
    socialUrl: row.social_url ?? undefined,
    avatarHue: row.avatar_hue,
  }
}

function rowToAdminEntry(row: Row): AdminEntry {
  return { ...rowToMember(row), status: row.status, createdAt: row.created_at }
}

export interface IntakeDb {
  insertIntake(member: ValidatedIntake): AdminEntry | null
  getById(id: string): AdminEntry | null
  listApprovedMembers(): Member[]
  listPending(): AdminEntry[]
  approve(id: string): AdminEntry | null
  reject(id: string): boolean
  close(): void
}

export function openDb(path: string = process.env.RELIF_DB_PATH ?? 'server/relif.db'): IntakeDb {
  const db = new DatabaseSync(path)
  for (const statement of SCHEMA_STATEMENTS) db.prepare(statement).run()

  const api: IntakeDb = {
    insertIntake(member) {
      const id = `intake-${randomUUID()}`
      db.prepare(
        `INSERT INTO intake_members
           (id, first_name, last_name, full_name, title, position, job_position_name,
            biography, affiliation_id, country, region, interest_ids, general_area_ids,
            languages, social_url, avatar_hue, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      ).run(
        id,
        member.firstName,
        member.lastName,
        member.fullName,
        // Localized { es, en, pt } object — serialized like the id arrays.
        JSON.stringify(member.title),
        member.position,
        member.jobPositionName,
        member.biography,
        member.affiliationId,
        member.country,
        member.region,
        JSON.stringify(member.interestIds),
        JSON.stringify(member.generalAreaIds),
        JSON.stringify(member.languages),
        member.socialUrl ?? null,
        member.avatarHue,
        new Date().toISOString(),
      )
      return api.getById(id)
    },

    getById(id) {
      const row = db.prepare('SELECT * FROM intake_members WHERE id = ?').get(id) as Row | undefined
      return row ? rowToAdminEntry(row) : null
    },

    listApprovedMembers() {
      return (
        db
          .prepare("SELECT * FROM intake_members WHERE status = 'approved' ORDER BY created_at DESC")
          .all() as Row[]
      ).map(rowToMember)
    },

    listPending() {
      return (
        db
          .prepare("SELECT * FROM intake_members WHERE status = 'pending' ORDER BY created_at ASC")
          .all() as Row[]
      ).map(rowToAdminEntry)
    },

    approve(id) {
      const result = db
        .prepare("UPDATE intake_members SET status = 'approved' WHERE id = ? AND status = 'pending'")
        .run(id)
      return result.changes > 0 ? api.getById(id) : null
    },

    reject(id) {
      const result = db
        .prepare("DELETE FROM intake_members WHERE id = ? AND status = 'pending'")
        .run(id)
      return result.changes > 0
    },

    close() {
      db.close()
    },
  }

  return api
}
