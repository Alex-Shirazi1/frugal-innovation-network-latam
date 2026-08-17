import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ApiDataProvider, useApiData } from './ApiDataContext'
import { seedMembers } from '../data/members'

describe('ApiDataProvider / useApiData', () => {
  beforeEach(() => {
    // No backend in unit tests — the provider must fall back to bundled data.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })

  it('renders immediately from the bundled snapshot', () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })
    expect(result.current.members).toHaveLength(seedMembers.length)
    expect(result.current.institutions.length).toBeGreaterThan(0)
  })

  it('keeps serving bundled data after the backend hydration fails', async () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })
    await waitFor(() => expect(result.current.members).toHaveLength(seedMembers.length))
    expect(result.current.resources.length).toBeGreaterThan(0)
  })

  /**
   * The provider used to expose addMember(), which the join form called to
   * prepend the submitter to the directory the instant they hit send. That
   * published someone as a member before the network had met them, so the
   * capability is gone rather than merely unused — a submission must not be
   * able to change what the directory shows.
   */
  it('does not grow the directory when a submission is made', async () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })

    await result.current.submitIntake({
      fullName: 'Ada Lovelace',
      email: 'ada@example.org',
      position: 'independent',
      jobPositionName: 'Consultora',
      biography: 'Trabaja en soluciones de bajo costo con comunidades rurales.',
      affiliationId: null,
      country: 'México',
      region: 'Jalisco',
      interestIds: ['salud'],
      generalAreaIds: ['ingenieria'],
      languages: ['es'],
      socialUrl: '',
      consentToPublish: true,
    })

    await waitFor(() => expect(result.current.members).toHaveLength(seedMembers.length))
    expect(result.current.members.some((m) => m.fullName === 'Ada Lovelace')).toBe(false)
  })

  it('resolves institution names and exposes only mappable institutions', () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })

    expect(result.current.institutionName(null)).toBeNull()
    expect(result.current.institutionName('does-not-exist')).toBeNull()
    expect(result.current.institutionName('iteso')).toContain('ITESO')
    expect(result.current.mappedInstitutions.every((i) => i.coords !== undefined)).toBe(true)
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useApiData())).toThrow(
      'useApiData must be used within ApiDataProvider',
    )
  })
})
