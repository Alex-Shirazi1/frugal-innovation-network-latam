import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledDataSource } from './adapters/bundled'
import { createHttpDataSource } from './adapters/http'
import { createFallbackDataSource } from './fallback'
import type { IntakeSubmission } from './types'

const validSubmission: IntakeSubmission = {
  fullName: 'Ana Prueba García',
  position: 'researcher',
  affiliationId: 'iteso',
  country: 'México',
  region: 'Jalisco',
  interestIds: ['salud', 'energia'],
  socialUrl: 'https://linkedin.com/in/ana-prueba',
  cvFileName: null,
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
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
      expect.arrayContaining(['agendaDay1', 'agendaDay2', 'speakers', 'conferenceVideos', 'galleryTiles']),
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
    ['region/country mismatch', { ...validSubmission, region: 'Lima' }, 'invalid-location'],
    ['unknown interests', { ...validSubmission, interestIds: ['x'] }, 'missing-interests'],
    ['bad url', { ...validSubmission, socialUrl: 'nope' }, 'invalid-url'],
  ])('rejects %s', async (_label, submission, code) => {
    const result = await bundledDataSource.submitIntake(submission as IntakeSubmission)
    expect(result).toEqual({ success: false, error: code })
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

  it('throws when the envelope reports failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false, data: null, error: 'boom' })))
    await expect(createHttpDataSource('/api').getMembers()).rejects.toThrow('boom')
  })

  it('maps intake validation errors without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: false, data: null, error: 'invalid-location' })),
    )
    const result = await createHttpDataSource('/api').submitIntake(validSubmission)
    expect(result).toEqual({ success: false, error: 'invalid-location' })
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

  it('does not retry intake validation failures against the fallback', async () => {
    const primary = {
      ...bundledDataSource,
      submitIntake: vi.fn().mockResolvedValue({ success: false, error: 'invalid-url' }),
    }
    const fallback = { ...bundledDataSource, submitIntake: vi.fn() }
    const source = createFallbackDataSource(primary, fallback)

    const result = await source.submitIntake(validSubmission)
    expect(result).toEqual({ success: false, error: 'invalid-url' })
    expect(fallback.submitIntake).not.toHaveBeenCalled()
  })
})
