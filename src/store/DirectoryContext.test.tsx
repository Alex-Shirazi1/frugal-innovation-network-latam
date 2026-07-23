import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DirectoryProvider, useDirectory } from './DirectoryContext'
import { mockMembers, type Member } from '../data/members'

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

describe('DirectoryProvider / useDirectory', () => {
  it('seeds the directory with the mock members', () => {
    const { result } = renderHook(() => useDirectory(), { wrapper: DirectoryProvider })
    expect(result.current.members).toHaveLength(mockMembers.length)
    expect(result.current.lastAddedId).toBeNull()
  })

  it('prepends a newly added member and tracks it as lastAddedId', () => {
    const { result } = renderHook(() => useDirectory(), { wrapper: DirectoryProvider })
    const initialCount = result.current.members.length

    act(() => result.current.addMember(makeMember('intake-1')))

    expect(result.current.members).toHaveLength(initialCount + 1)
    expect(result.current.members[0].id).toBe('intake-1')
    expect(result.current.lastAddedId).toBe('intake-1')
  })

  it('keeps the most recently added member at the front', () => {
    const { result } = renderHook(() => useDirectory(), { wrapper: DirectoryProvider })

    act(() => result.current.addMember(makeMember('first')))
    act(() => result.current.addMember(makeMember('second')))

    expect(result.current.members[0].id).toBe('second')
    expect(result.current.members[1].id).toBe('first')
    expect(result.current.lastAddedId).toBe('second')
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useDirectory())).toThrow(
      'useDirectory must be used within DirectoryProvider',
    )
  })
})
