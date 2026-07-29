import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { bibliography } from '../src/data/bibliography'

/**
 * Lives in server/ rather than src/ because it touches the filesystem, and the
 * vitest 'server' project is the one that runs in the node environment. Keeping
 * node APIs out of src/ also keeps tsconfig.app.json free of node types — a
 * stray `node:fs` import there breaks `tsc -b`, and therefore the build.
 */
describe('bibliography files on disk', () => {
  it('every catalogue entry points at a file that exists', () => {
    const missing = bibliography
      .filter((e) => !existsSync(join(process.cwd(), 'public', e.file.replace(/^\//, ''))))
      .map((e) => e.paperNumber)
    expect(missing).toEqual([])
  })

  it('recorded sizes match the files on disk', () => {
    for (const entry of bibliography) {
      const actualKb = Math.round(
        statSync(join(process.cwd(), 'public', entry.file.replace(/^\//, ''))).size / 1024,
      )
      expect(actualKb).toBe(entry.sizeKb)
    }
  })

  it('ships no zero-byte or suspiciously tiny PDFs', () => {
    for (const entry of bibliography) {
      expect(entry.sizeKb).toBeGreaterThan(20)
    }
  })
})
