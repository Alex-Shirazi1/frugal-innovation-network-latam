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
import { annualMeetingVideos, speakers } from '../data/conference'
import {
  countries,
  generalAreas,
  languageOptions,
  positionTypes,
  researchInterests,
} from '../data/onboardingOptions'

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
 * Runs `task` once the browser is done with the work that matters for first
 * paint. `requestIdleCallback` is unavailable in Safari <16.4 and in jsdom, so
 * a timeout stands in; either way the deadline keeps hydration from being
 * postponed indefinitely on a busy main thread.
 */
function whenIdle(task: () => void, timeout = 2000): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(task, { timeout })
    return () => cancelIdleCallback(handle)
  }
  const handle = setTimeout(task, 200)
  return () => clearTimeout(handle)
}

/**
 * Loads every dataset through the active RelifDataSource. Renders instantly
 * from the bundled snapshot, then hydrates from the backend when reachable —
 * so the UI never blocks on the network and still works fully offline.
 */
export function ApiDataProvider({ children }: { children: ReactNode }) {
  // Lazy init: `useRef(createDataSource())` would re-run the factory on every
  // render and throw the result away.
  const dataSourceRef = useRef<ReturnType<typeof createDataSource> | null>(null)
  if (dataSourceRef.current === null) dataSourceRef.current = createDataSource()
  // Stable for the life of the provider, so closing over it is safe.
  const dataSource = dataSourceRef.current
  const [institutions, setInstitutions] = useState<Institution[]>(bundledInstitutions)
  const [members, setMembers] = useState<Member[]>(mockMembers)
  const [resources, setResources] = useState<Resource[]>(bundledResources)
  const [conference, setConference] = useState<ConferenceData>({ speakers, annualMeetingVideos })
  const [options, setOptions] = useState<OnboardingOptions>({
    countries,
    positionTypes,
    researchInterests,
    generalAreas,
    languageOptions,
  })
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  /**
   * Every dataset above already renders from the bundled snapshot, so this
   * hydration only ever *replaces* correct content with fresher content. That
   * makes it safe — and necessary — to hold until the browser is idle: reaching
   * Firestore drags in ~100kb of SDK, which competes with first paint for a
   * result no reader is waiting on.
   */
  useEffect(() => {
    let cancelled = false
    const cancelIdle = whenIdle(() => {
      const source = dataSourceRef.current
      if (cancelled || source === null) return
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
    })
    return () => {
      cancelled = true
      cancelIdle()
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
        dataSource.submitIntake(submission).catch(
          // Both adapters failed (or bundled threw): degrade to local processing.
          () => bundledDataSource.submitIntake(submission),
        ),
      institutionName: (affiliationId: string | null) => {
        if (!affiliationId) return null
        return institutions.find((i) => i.id === affiliationId)?.name ?? null
      },
    }
  }, [dataSource, institutions, members, resources, conference, options, lastAddedId])

  return <ApiDataContext.Provider value={value}>{children}</ApiDataContext.Provider>
}

export function useApiData(): ApiDataValue {
  const ctx = useContext(ApiDataContext)
  if (!ctx) {
    throw new Error('useApiData must be used within ApiDataProvider')
  }
  return ctx
}
