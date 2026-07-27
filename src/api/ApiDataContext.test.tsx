import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiDataProvider, useApiData } from './ApiDataContext'
import { mockMembers } from '../data/members'
import type { Member } from './types'

function makeMember(id: string): Member {
  return {
    id,
    fullName: 'Test Member',
    title: { es: 'Prueba', en: 'Test', pt: 'Teste' },
    position: 'independent',
    affiliationId: null,
    country: 'México',
    region: 'Jalisco',
    interestIds: ['salud'],
    avatarHue: 42,
  }
}

describe('ApiDataProvider / useApiData', () => {
  beforeEach(() => {
    // No backend in unit tests — the provider must fall back to bundled data.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })

  it('renders immediately from the bundled snapshot', () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })
    expect(result.current.members).toHaveLength(mockMembers.length)
    expect(result.current.lastAddedId).toBeNull()
    expect(result.current.institutions.length).toBeGreaterThan(0)
  })

  it('keeps serving bundled data after the backend hydration fails', async () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })
    await waitFor(() => expect(result.current.members).toHaveLength(mockMembers.length))
    expect(result.current.resources.length).toBeGreaterThan(0)
  })

  it('prepends a newly added member and tracks it as lastAddedId', () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })
    const initialCount = result.current.members.length

    act(() => result.current.addMember(makeMember('intake-1')))

    expect(result.current.members).toHaveLength(initialCount + 1)
    expect(result.current.members[0].id).toBe('intake-1')
    expect(result.current.lastAddedId).toBe('intake-1')
  })

  it('keeps the most recently added member at the front', () => {
    const { result } = renderHook(() => useApiData(), { wrapper: ApiDataProvider })

    act(() => result.current.addMember(makeMember('first')))
    act(() => result.current.addMember(makeMember('second')))

    expect(result.current.members[0].id).toBe('second')
    expect(result.current.members[1].id).toBe('first')
    expect(result.current.lastAddedId).toBe('second')
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
