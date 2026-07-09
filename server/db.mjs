/**
 * SQLite persistence for intake submissions (node:sqlite, zero native deps).
 * Seed/content data stays in server/data/*.json — the DB only holds records
 * created at runtime through the intake pipeline.
 */
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS intake_members (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    title TEXT NOT NULL,
    position TEXT NOT NULL,
    affiliation_id TEXT,
    country TEXT NOT NULL,
    region TEXT NOT NULL,
    interest_ids TEXT NOT NULL,
    social_url TEXT,
    cv_file_name TEXT,
    avatar_hue INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_intake_members_status ON intake_members (status);
`

/** Maps a DB row to the frontend Member shape (camelCase, parsed JSON). */
function rowToMember(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    title: JSON.parse(row.title),
    position: row.position,
    affiliationId: row.affiliation_id ?? null,
    country: row.country,
    region: row.region,
    interestIds: JSON.parse(row.interest_ids),
    socialUrl: row.social_url ?? undefined,
    avatarHue: row.avatar_hue,
  }
}

function rowToAdminEntry(row) {
  return {
    ...rowToMember(row),
    cvFileName: row.cv_file_name ?? null,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function openDb(path = process.env.RELIF_DB_PATH ?? 'server/relif.db') {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)

  return {
    insertIntake(member) {
      const id = `intake-${randomUUID()}`
      db.prepare(
        `INSERT INTO intake_members
           (id, full_name, title, position, affiliation_id, country, region,
            interest_ids, social_url, cv_file_name, avatar_hue, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      ).run(
        id,
        member.fullName,
        // Localized { es, en, pt } object — serialized like interest_ids
        JSON.stringify(member.title),
        member.position,
        member.affiliationId,
        member.country,
        member.region,
        JSON.stringify(member.interestIds),
        member.socialUrl ?? null,
        member.cvFileName ?? null,
        member.avatarHue,
        new Date().toISOString(),
      )
      return this.getById(id)
    },

    getById(id) {
      const row = db.prepare('SELECT * FROM intake_members WHERE id = ?').get(id)
      return row ? rowToAdminEntry(row) : null
    },

    listApprovedMembers() {
      return db
        .prepare("SELECT * FROM intake_members WHERE status = 'approved' ORDER BY created_at DESC")
        .all()
        .map(rowToMember)
    },

    listPending() {
      return db
        .prepare("SELECT * FROM intake_members WHERE status = 'pending' ORDER BY created_at ASC")
        .all()
        .map(rowToAdminEntry)
    },

    approve(id) {
      const result = db
        .prepare("UPDATE intake_members SET status = 'approved' WHERE id = ? AND status = 'pending'")
        .run(id)
      return result.changes > 0 ? this.getById(id) : null
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
}
