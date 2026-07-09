/**
 * Guards against drift between the canonical TS datasets (src/data, used by
 * the bundled adapter) and the generated JSON (server/data, served by the
 * backend). If this fails, run: npm run seed
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { institutions } from '../src/data/institutions'
import { mockMembers } from '../src/data/members'
import { resources } from '../src/data/resources'
import {
  agendaDay1,
  agendaDay2,
  conferenceVideos,
  galleryTiles,
  speakers,
} from '../src/data/conference'
import { countries, positionTypes, researchInterests } from '../src/data/onboardingOptions'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'data')
const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'))

// Round-trip through JSON so `undefined` fields compare like the seed output.
const normalize = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe('server/data JSON matches src/data (run `npm run seed` if not)', () => {
  it.each([
    ['institutions', institutions],
    ['members', mockMembers],
    ['resources', resources],
    ['conference', { agendaDay1, agendaDay2, speakers, conferenceVideos, galleryTiles }],
    ['onboarding-options', { countries, positionTypes, researchInterests }],
  ])('%s.json is in sync', (name, canonical) => {
    expect(readJson(name)).toEqual(normalize(canonical))
  })
})
