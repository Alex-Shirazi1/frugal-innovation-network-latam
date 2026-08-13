import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledDataSource } from './adapters/bundled'
import { createHttpDataSource } from './adapters/http'
import { createFallbackDataSource } from './fallback'
import type { IntakeSubmission } from './types'
import { makeSubmission } from '../test/fixtures'

const validSubmission: IntakeSubmission = makeSubmission()

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}

/** What static hosting returns for /api/* — the SPA shell, with a 200. */
function spaShellResponse(): Response {
  return new Response('<!doctype html><html lang="es"><body></body></html>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('bundledDataSource', () => {
  it('serves all datasets from the bundle', async () => {
    expect(await bundledDataSource.getMembers()).toHaveLength(54)
    expect((await bundledDataSource.getInstitutions()).length).toBeGreaterThan(30)
    expect((await bundledDataSource.getResources()).length).toBeGreaterThan(0)
    expect(Object.keys(await bundledDataSource.getConference())).toEqual(
      expect.arrayContaining(['speakers', 'annualMeetingVideos']),
    )
    const options = await bundledDataSource.getOnboardingOptions()
    expect(options.positionTypes).toContain('independent')
  })

  it('accepts a valid intake locally', async () => {
    const result = await bundledDataSource.submitIntake(validSubmission)
    expect(result.success).toBe(true)
    expect(result.data?.title).toEqual({ es: 'Investigador/a', en: 'Researcher', pt: 'Pesquisador/a' })
  })

  it.each([
    ['empty name', { ...validSubmission, fullName: ' ' }, 'missing-required'],
    ['no general areas', { ...validSubmission, generalAreaIds: [] }, 'missing-areas'],
    ['no languages', { ...validSubmission, languages: [] }, 'missing-languages'],
    ['consent withheld', { ...validSubmission, consentToPublish: false }, 'consent-required'],
    ['region/country mismatch', { ...validSubmission, region: 'Lima' }, 'invalid-location'],
    ['unknown interests', { ...validSubmission, interestIds: ['x'] }, 'missing-interests'],
    ['bad url', { ...validSubmission, socialUrl: 'nope' }, 'invalid-url'],
  ])('rejects %s', async (_label, submission, code) => {
    const result = await bundledDataSource.submitIntake(submission as IntakeSubmission)
    expect(result).toEqual({ success: false, error: code, persisted: false })
  })
})

describe('createHttpDataSource', () => {
  it('unwraps the { success, data, error } envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [{ id: 'x' }], error: null }))
    vi.stubGlobal('fetch', fetchMock)

    const source = createHttpDataSource('/api')
    expect(await source.getInstitutions()).toEqual([{ id: 'x' }])
    expect(fetchMock).toHaveBeenCalledWith('/api/institutions', expect.anything())
  })

  /**
   * On static hosting the SPA catch-all rewrite answers /api/* with index.html
   * and a 200, so status alone proves nothing. Without the content-type check
   * this surfaced as a confusing JSON parse error instead of "no backend".
   */
  it('treats an HTML response as no backend rather than a parse error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(spaShellResponse()))
    await expect(createHttpDataSource('/api').getMembers()).rejects.toThrow(/no API at/)
  })

  it('names the no-backend error so callers can distinguish it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(spaShellResponse()))
    await createHttpDataSource('/api')
      .getMembers()
      .catch((error: unknown) => {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).name).toBe('NoBackendError')
      })
  })

  it('falls back to bundled data when the URL serves the SPA shell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(spaShellResponse()))
    const source = createFallbackDataSource(createHttpDataSource('/api'), bundledDataSource)
    expect(await source.getMembers()).toHaveLength(54)

    // And an intake against a non-existent backend must not claim persistence.
    const result = await source.submitIntake(validSubmission)
    expect(result.success).toBe(true)
    expect(result.persisted).toBe(false)
  })

  it('throws when the envelope reports failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false, data: null, error: 'boom' })))
    await expect(createHttpDataSource('/api').getMembers()).rejects.toThrow('boom')
  })

  it('reports persisted: true when a backend accepted the record', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: 'intake-1' }, error: null })),
    )
    const result = await createHttpDataSource('/api').submitIntake(validSubmission)
    expect(result.success).toBe(true)
    expect(result.persisted).toBe(true)
  })

  it('reports persisted: false when the backend rejected the record', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: false, data: null, error: 'invalid-url' })),
    )
    const result = await createHttpDataSource('/api').submitIntake(validSubmission)
    expect(result.persisted).toBe(false)
  })

  it('maps intake validation errors without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: false, data: null, error: 'invalid-location' })),
    )
    const result = await createHttpDataSource('/api').submitIntake(validSubmission)
    expect(result).toEqual({ success: false, error: 'invalid-location', persisted: false })
  })

  it('POSTs intake submissions to the intake endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { id: 'intake-1', status: 'pending' }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await createHttpDataSource('/api').submitIntake(validSubmission)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/members/intake')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).fullName).toBe('Ana Prueba García')
  })
})

describe('createFallbackDataSource', () => {
  it('uses the fallback when the primary is unreachable', async () => {
    const onFallback = vi.fn()
    const primary = { ...bundledDataSource, getMembers: vi.fn().mockRejectedValue(new Error('down')) }
    const source = createFallbackDataSource(primary, bundledDataSource, onFallback)

    expect(await source.getMembers()).toHaveLength(54)
    expect(onFallback).toHaveBeenCalledWith('getMembers', expect.any(Error))
  })

  it('passes primary results through without touching the fallback', async () => {
    const fallbackSpy = { ...bundledDataSource, getMembers: vi.fn() }
    const source = createFallbackDataSource(bundledDataSource, fallbackSpy)

    expect(await source.getMembers()).toHaveLength(54)
    expect(fallbackSpy.getMembers).not.toHaveBeenCalled()
  })

  it('marks a submission non-persisted when it falls back to bundled data', async () => {
    const primary = {
      ...bundledDataSource,
      submitIntake: vi.fn().mockRejectedValue(new Error('network down')),
    }
    const source = createFallbackDataSource(primary, bundledDataSource)

    const result = await source.submitIntake(validSubmission)
    expect(result.success).toBe(true)
    // Validated locally, stored nowhere — the UI must not claim success.
    expect(result.persisted).toBe(false)
  })

  it('does not retry intake validation failures against the fallback', async () => {
    const primary = {
      ...bundledDataSource,
      submitIntake: vi.fn().mockResolvedValue({ success: false, error: 'invalid-url', persisted: false }),
    }
    const fallback = { ...bundledDataSource, submitIntake: vi.fn() }
    const source = createFallbackDataSource(primary, fallback)

    const result = await source.submitIntake(validSubmission)
    expect(result).toEqual({ success: false, error: 'invalid-url', persisted: false })
    expect(fallback.submitIntake).not.toHaveBeenCalled()
  })
})
