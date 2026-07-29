import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Guards the lockfile against npm's optional-dependency pruning.
 *
 * npm drops optional platform packages it does not need on the machine running
 * the install, so any `npm install` on macOS silently removes the Linux native
 * bindings the CI runner requires — and `npm ci` then refuses to install at all.
 * This has broken the build four separate times, always discovered only after a
 * push, because nothing locally objected.
 *
 * `npm run relock` produces a complete graph. This test is what makes forgetting
 * to run it a local failure instead of a CI failure.
 */
interface Lockfile {
  packages: Record<string, { version?: string; dependencies?: Record<string, string> }>
}

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as Lockfile
const paths = Object.keys(lock.packages)

/** Native bindings ship one package per platform; all must be recorded. */
const requiredPlatforms = ['linux-x64-gnu', 'darwin-arm64', 'darwin-x64', 'win32-x64']

describe('package-lock.json is cross-platform', () => {
  it.each(requiredPlatforms)('records native bindings for %s', (platform) => {
    const entries = paths.filter((p) => p.includes(platform))
    expect(entries.length, `no ${platform} bindings — run: npm run relock`).toBeGreaterThan(0)
  })

  /**
   * The specific packages that keep going missing. They back the wasm32-wasi
   * fallback bindings, which npm treats as optional and prunes aggressively.
   */
  it.each(['@emnapi/core', '@emnapi/runtime', '@emnapi/wasi-threads'])(
    'provides %s',
    (name) => {
      const provided = paths.some((p) => p.endsWith(`node_modules/${name}`))
      expect(provided, `${name} missing from the lockfile — run: npm run relock`).toBe(true)
    },
  )

  /**
   * The failure mode npm reports as "Missing: X from lock file": something
   * depends on a package that has no entry anywhere in the tree.
   */
  it('has an entry for every dependency it references', () => {
    const provided = new Set(
      paths.map((p) => p.replace(/^.*node_modules\//, '')).filter(Boolean),
    )
    const dangling = new Set<string>()
    for (const meta of Object.values(lock.packages)) {
      for (const dep of Object.keys(meta.dependencies ?? {})) {
        if (!provided.has(dep)) dangling.add(dep)
      }
    }
    expect([...dangling], 'run: npm run relock').toEqual([])
  })
})
