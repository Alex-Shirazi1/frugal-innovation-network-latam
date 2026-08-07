/**
 * HTTP adapter: talks to any backend exposing the RELIF REST contract
 * ({ success, data, error } envelope). The base URL comes from
 * VITE_API_BASE_URL, so pointing the site at a different backend is an
 * environment change, not a code change.
 */
import type { RelifDataSource } from '../dataSource'
import type { ApiResponse, IntakeErrorCode, IntakeResult, IntakeSubmission, Member } from '../types'

const REQUEST_TIMEOUT_MS = 8000

/** Thrown when the URL answered but not with an API response. */
export class NoBackendError extends Error {
  constructor(url: string) {
    super(`no API at ${url}`)
    this.name = 'NoBackendError'
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  // On static hosting the SPA catch-all rewrite answers /api/* with index.html,
  // so a 200 proves nothing. Checking the content type first turns a confusing
  // JSON parse error into a clear "there is no backend here".
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    throw new NoBackendError(url)
  }
  return (await response.json()) as ApiResponse<T>
}

export function createHttpDataSource(
  baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api',
): RelifDataSource {
  async function get<T>(path: string): Promise<T> {
    const body = await requestJson<T>(`${baseUrl}${path}`)
    if (!body.success || body.data === null) {
      throw new Error(`API error on ${path}: ${body.error ?? 'empty response'}`)
    }
    return body.data
  }

  return {
    getInstitutions: () => get('/institutions'),
    getInitiatives: () => get('/initiatives'),
    getBibliography: () => get('/bibliography'),
    getMembers: () => get('/members'),
    getResources: () => get('/resources'),
    getConference: () => get('/conference'),
    getOnboardingOptions: () => get('/onboarding-options'),

    async submitIntake(submission: IntakeSubmission): Promise<IntakeResult> {
      let body: ApiResponse<Member>
      try {
        body = await requestJson(`${baseUrl}/members/intake`, {
          method: 'POST',
          body: JSON.stringify(submission),
        })
      } catch (error: unknown) {
        // Network-level failure — signal the caller so the fallback can take over.
        throw error instanceof Error ? error : new Error('network')
      }
      if (!body.success || !body.data) {
        return {
          success: false,
          error: (body.error ?? 'network') as IntakeErrorCode,
          persisted: false,
        }
      }
      // Reached a real backend that accepted and durably stored the record.
      return { success: true, data: body.data, persisted: true }
    },
  }
}
