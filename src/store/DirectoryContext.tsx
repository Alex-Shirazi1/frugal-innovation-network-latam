import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { mockMembers, type Member } from '../data/members'

interface DirectoryValue {
  members: Member[]
  addMember: (member: Member) => void
  lastAddedId: string | null
}

const DirectoryContext = createContext<DirectoryValue | null>(null)

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(mockMembers)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  const value = useMemo<DirectoryValue>(
    () => ({
      members,
      addMember: (member: Member) => {
        setMembers((prev) => [member, ...prev])
        setLastAddedId(member.id)
      },
      lastAddedId,
    }),
    [members, lastAddedId],
  )

  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>
}

export function useDirectory(): DirectoryValue {
  const ctx = useContext(DirectoryContext)
  if (!ctx) {
    throw new Error('useDirectory must be used within DirectoryProvider')
  }
  return ctx
}
