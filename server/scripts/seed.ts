/**
 * Dumps the canonical in-repo datasets to server/data/*.json.
 * The JSON files are the single source of truth consumed by BOTH the
 * prototype backend (served over HTTP) and the frontend bundled adapter
 * (imported directly as an offline fallback).
 *
 * Run with: npm run seed
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { institutions } from '../../src/data/institutions'
import { mockMembers } from '../../src/data/members'
import { resources } from '../../src/data/resources'
import {
  agendaDay1,
  agendaDay2,
  speakers,
  conferenceVideos,
  galleryTiles,
} from '../../src/data/conference'
import { countries, positionTypes, researchInterests } from '../../src/data/onboardingOptions'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
mkdirSync(outDir, { recursive: true })

function dump(name: string, value: unknown): void {
  const file = join(outDir, `${name}.json`)
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  console.log(`wrote ${file}`)
}

dump('institutions', institutions)
dump('members', mockMembers)
dump('resources', resources)
dump('conference', { agendaDay1, agendaDay2, speakers, conferenceVideos, galleryTiles })
dump('onboarding-options', { countries, positionTypes, researchInterests })
