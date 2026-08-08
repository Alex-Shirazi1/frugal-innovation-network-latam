import type { RelifDataSource } from './dataSource'
import { bundledDataSource } from './adapters/bundled'
import { createHttpDataSource } from './adapters/http'
import { createFallbackDataSource } from './fallback'
import { readFirebaseConfig } from '../lib/firebase'

export type { RelifDataSource } from './dataSource'
export * from './types'

export type DataSourceKind = 'bundled' | 'firestore' | 'http'

/**
 * Resolves which backend to use. An explicit VITE_DATA_SOURCE wins; otherwise a
 * complete Firebase config implies Firestore, and with neither we fall back to
 * the local Express contract at VITE_API_BASE_URL.
 */
export function resolveDataSourceKind(): DataSourceKind {
  const explicit = import.meta.env.VITE_DATA_SOURCE
  if (explicit === 'bundled' || explicit === 'firestore' || explicit === 'http') return explicit
  return readFirebaseConfig() ? 'firestore' : 'http'
}

/**
 * Selects the active data source. Remote options are wrapped so an unreachable
 * backend degrades to bundled content rather than an empty page — but a
 * fallback intake reports `persisted: false`, so the UI still tells the truth
 * about submissions that were never stored.
 */
export function createDataSource(): RelifDataSource {
  const kind = resolveDataSourceKind()

  if (kind === 'bundled') return bundledDataSource

  if (kind === 'firestore') {
    const config = readFirebaseConfig()
    if (!config) {
      console.warn('[relif-api] VITE_DATA_SOURCE=firestore but Firebase env vars are incomplete')
      return bundledDataSource
    }
    // Imported lazily so the Firebase SDK stays out of the main chunk.
    const firestorePromise = import('./adapters/firestore').then((m) =>
      m.createFirestoreDataSource(config),
    )
    const deferred: RelifDataSource = {
      getInstitutions: () => firestorePromise.then((s) => s.getInstitutions()),
      getInitiatives: () => firestorePromise.then((s) => s.getInitiatives()),
      getBibliography: () => firestorePromise.then((s) => s.getBibliography()),
      getCongress: () => firestorePromise.then((s) => s.getCongress()),
      getMembers: () => firestorePromise.then((s) => s.getMembers()),
      getResources: () => firestorePromise.then((s) => s.getResources()),
      getConference: () => firestorePromise.then((s) => s.getConference()),
      getOnboardingOptions: () => firestorePromise.then((s) => s.getOnboardingOptions()),
      submitIntake: (submission) => firestorePromise.then((s) => s.submitIntake(submission)),
    }
    return createFallbackDataSource(deferred, bundledDataSource, (method, error) => {
      console.warn(`[relif-api] firestore ${method} unavailable, using bundled data`, error)
    })
  }

  return createFallbackDataSource(createHttpDataSource(), bundledDataSource, warnOnce)
}

/**
 * All five content loads fail together when there is no backend, which produced
 * five identical console warnings on every page load. One line is enough.
 */
function makeWarnOnce() {
  let warned = false
  return (method: string, error: unknown) => {
    if (warned) return
    warned = true
    const noBackend = error instanceof Error && error.name === 'NoBackendError'
    console.info(
      noBackend
        ? '[relif-api] no backend at this URL — serving bundled data. Submissions will report that nothing was saved.'
        : `[relif-api] backend unreachable (${method}) — serving bundled data`,
      noBackend ? '' : error,
    )
  }
}

const warnOnce = makeWarnOnce()
