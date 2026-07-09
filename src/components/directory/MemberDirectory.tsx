import { useDeferredValue, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useDirectory } from '../../store/DirectoryContext'
import { SectionHeading } from '../ui/SectionHeading'
import { MemberCard } from './MemberCard'
import { institutions } from '../../data/institutions'
import { institutionName } from '../../data/members'
import { researchInterests, type PositionType } from '../../data/onboardingOptions'

type PositionFilter = PositionType | 'all'

function InstitutionConveyor() {
  const { t } = useI18n()
  // Track is duplicated so the loop is seamless; aria-hidden on the copy.
  const names = institutions.map((i) => i.name)
  return (
    <div className="conveyor overflow-hidden border-y border-carbon/10 bg-white/50 py-4" aria-label={t.directory.institutionsTitle}>
      <div className="conveyor-track flex w-max gap-3">
        {[false, true].map((isCopy) => (
          <ul key={String(isCopy)} className="flex gap-3" aria-hidden={isCopy}>
            {names.map((name) => (
              <li
                key={name}
                className="whitespace-nowrap rounded-full border border-carbon/10 bg-blanco px-4 py-1.5 text-xs font-medium text-pizarra"
              >
                {name}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

export function MemberDirectory() {
  const { t, lang } = useI18n()
  const { members, lastAddedId } = useDirectory()
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<PositionFilter>('all')
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return members.filter((member) => {
      if (position !== 'all' && member.position !== position) return false
      if (!q) return true
      const interests = member.interestIds
        .map((id) => {
          const interest = researchInterests.find((entry) => entry.id === id)
          return interest ? `${interest.es} ${interest.en}` : ''
        })
        .join(' ')
      return [member.fullName, member.title.es, member.title.en, member.title.pt, institutionName(member.affiliationId) ?? '', member.country, interests]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [members, deferredQuery, position])

  const positionFilters: PositionFilter[] = [
    'all',
    'faculty',
    'researcher',
    'staff',
    'administrator',
    'independent',
  ]

  return (
    <section id="miembros" aria-labelledby="miembros-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="miembros-heading"
          kicker={t.directory.kicker}
          title={t.directory.title}
          subtitle={t.directory.subtitle}
        />
      </div>

      <InstitutionConveyor />

      <div className="mx-auto max-w-7xl px-4 md:px-8 pt-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.directory.searchPlaceholder}
            aria-label={t.directory.searchPlaceholder}
            className="w-full max-w-md rounded-full border border-carbon/15 bg-white/70 px-5 py-3 text-sm outline-none transition-colors focus:border-teal"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.map.filterTitle}>
            {positionFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setPosition(filter)}
                aria-pressed={position === filter}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  position === filter
                    ? 'bg-carbon text-blanco'
                    : 'border border-carbon/15 text-pizarra hover:border-carbon/35'
                }`}
              >
                {filter === 'all' ? t.directory.filterAll : t.onboarding.positions[filter]}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm text-pizarra" role="status">
          {t.directory.showing} {filtered.length} {t.directory.people}
        </p>

        {filtered.length > 0 ? (
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            style={{ contentVisibility: 'auto' }}
            lang={lang}
          >
            {filtered.map((member) => (
              <MemberCard key={member.id} member={member} highlighted={member.id === lastAddedId} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-carbon/20 p-10 text-center text-pizarra">
            {t.directory.noResults}
          </p>
        )}
      </div>
    </section>
  )
}
