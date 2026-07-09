import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createDataSource } from './index'
import { bundledDataSource } from './adapters/bundled'
import type {
  ConferenceData,
  Institution,
  IntakeResult,
  IntakeSubmission,
  Member,
  OnboardingOptions,
  Resource,
} from './types'
import { mockMembers } from '../data/members'
import { institutions as bundledInstitutions } from '../data/institutions'
import { resources as bundledResources } from '../data/resources'
import {
  agendaDay1,
  agendaDay2,
  conferenceVideos,
  galleryTiles,
  speakers,
} from '../data/conference'
import { countries, positionTypes, researchInterests } from '../data/onboardingOptions'

interface ApiDataValue {
  institutions: Institution[]
  /** Institutions with coordinates, plottable on the map. */
  mappedInstitutions: Array<Institution & { coords: [number, number] }>
  memberCountries: string[]
  members: Member[]
  resources: Resource[]
  conference: ConferenceData
  options: OnboardingOptions
  lastAddedId: string | null
  addMember: (member: Member) => void
  submitIntake: (submission: IntakeSubmission) => Promise<IntakeResult>
  institutionName: (affiliationId: string | null) => string | null
}

const ApiDataContext = createContext<ApiDataValue | null>(null)

/**
 * Loads every dataset through the active RelifDataSource. Renders instantly
 * from the bundled snapshot, then hydrates from the backend when reachable —
 * so the UI never blocks on the network and still works fully offline.
 */
export function ApiDataProvider({ children }: { children: ReactNode }) {
  const dataSourceRef = useRef(createDataSource())
  const [institutions, setInstitutions] = useState<Institution[]>(bundledInstitutions)
  const [members, setMembers] = useState<Member[]>(mockMembers)
  const [resources, setResources] = useState<Resource[]>(bundledResources)
  const [conference, setConference] = useState<ConferenceData>({
    agendaDay1,
    agendaDay2,
    speakers,
    conferenceVideos,
    galleryTiles,
  })
  const [options, setOptions] = useState<OnboardingOptions>({
    countries,
    positionTypes,
    researchInterests,
  })
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  useEffect(() => {
    const source = dataSourceRef.current
    let cancelled = false
    const hydrate = <T,>(load: Promise<T>, apply: (value: T) => void) =>
      load.then((value) => {
        if (!cancelled) apply(value)
      })

    void Promise.allSettled([
      hydrate(source.getInstitutions(), setInstitutions),
      hydrate(source.getMembers(), setMembers),
      hydrate(source.getResources(), setResources),
      hydrate(source.getConference(), setConference),
      hydrate(source.getOnboardingOptions(), setOptions),
    ])
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<ApiDataValue>(() => {
    const mappedInstitutions = institutions.filter(
      (i): i is Institution & { coords: [number, number] } => i.coords !== undefined,
    )
    return {
      institutions,
      mappedInstitutions,
      memberCountries: [...new Set(institutions.map((i) => i.country))],
      members,
      resources,
      conference,
      options,
      lastAddedId,
      addMember: (member: Member) => {
        setMembers((prev) => [member, ...prev])
        setLastAddedId(member.id)
      },
      submitIntake: (submission: IntakeSubmission) =>
        dataSourceRef.current.submitIntake(submission).catch(
          // Both adapters failed (or bundled threw): degrade to local processing.
          () => bundledDataSource.submitIntake(submission),
        ),
      institutionName: (affiliationId: string | null) => {
        if (!affiliationId) return null
        return institutions.find((i) => i.id === affiliationId)?.name ?? null
      },
    }
  }, [institutions, members, resources, conference, options, lastAddedId])

  return <ApiDataContext.Provider value={value}>{children}</ApiDataContext.Provider>
}

export function useApiData(): ApiDataValue {
  const ctx = useContext(ApiDataContext)
  if (!ctx) {
    throw new Error('useApiData must be used within ApiDataProvider')
  }
  return ctx
}
