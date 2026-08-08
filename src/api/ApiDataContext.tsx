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
import { notifyNewMember } from '../lib/notifyNewMember'
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
import { initiatives as bundledInitiatives, type Initiative } from '../data/initiatives'
import { bibliography as bundledBibliography, type BibliographyEntry } from '../data/bibliography'
import { congress as bundledCongress, type Congress } from '../data/congress'
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
  initiatives: Initiative[]
  bibliography: BibliographyEntry[]
  congress: Congress
  resources: Resource[]
  conference: ConferenceData
  options: OnboardingOptions
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
  const [initiatives, setInitiatives] = useState<Initiative[]>(bundledInitiatives)
  const [bibliography, setBibliography] = useState<BibliographyEntry[]>(bundledBibliography)
  const [congress, setCongress] = useState<Congress>(bundledCongress)
  const [resources, setResources] = useState<Resource[]>(bundledResources)
  const [conference, setConference] = useState<ConferenceData>({ speakers, annualMeetingVideos })
  const [options, setOptions] = useState<OnboardingOptions>({
    countries,
    positionTypes,
    researchInterests,
    generalAreas,
    languageOptions,
  })

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
        hydrate(source.getInitiatives(), setInitiatives),
        hydrate(source.getBibliography(), setBibliography),
        hydrate(source.getCongress(), setCongress),
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
      initiatives,
      bibliography,
      congress,
      resources,
      conference,
      options,
      /**
       * The single funnel for every submission, whatever adapter is behind it.
       *
       * The notification lives here rather than inside an adapter so it fires
       * on the local Express backend too — otherwise the only way to test that
       * the network actually receives an email would be to deploy. It is gated
       * on `persisted`, so the bundled fallback (which validates happily and
       * stores nothing) never mails anyone about an application that was not
       * kept.
       */
      submitIntake: async (submission: IntakeSubmission) => {
        const result = await dataSource.submitIntake(submission).catch(
          // Both adapters failed (or bundled threw): degrade to local processing.
          () => bundledDataSource.submitIntake(submission),
        )

        if (result.success && result.persisted) {
          // Not awaited: the application is already stored, so the submitter
          // should not wait on an email — nor be told anything failed if it
          // does. notifyNewMember never rejects.
          void notifyNewMember({
            submission,
            institutionName:
              institutions.find((i) => i.id === submission.affiliationId)?.name ?? null,
          })
        }

        return result
      },
      institutionName: (affiliationId: string | null) => {
        if (!affiliationId) return null
        return institutions.find((i) => i.id === affiliationId)?.name ?? null
      },
    }
  }, [
    dataSource,
    institutions,
    members,
    initiatives,
    bibliography,
    congress,
    resources,
    conference,
    options,
  ])

  return <ApiDataContext.Provider value={value}>{children}</ApiDataContext.Provider>
}

export function useApiData(): ApiDataValue {
  const ctx = useContext(ApiDataContext)
  if (!ctx) {
    throw new Error('useApiData must be used within ApiDataProvider')
  }
  return ctx
}
