import { useDeferredValue, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useApiData } from '../../api/ApiDataContext'
import { SectionHeading } from '../ui/SectionHeading'
import { Select } from '../ui/Select'
import { MemberCard } from './MemberCard'
import { MemberDetail } from './MemberDetail'
import { placeLabel } from '../../data/onboardingOptions'
import type { Member, PositionType } from '../../api/types'

type PositionFilter = PositionType | 'all'

/** Sentinel for "no filter applied", shared by all three filter controls. */
const ALL = 'all'

function InstitutionConveyor() {
  const { t } = useI18n()
  const { institutions } = useApiData()
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
  const { members, lastAddedId, institutionName, options } = useApiData()
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<PositionFilter>(ALL)
  const [area, setArea] = useState<string>(ALL)
  const [country, setCountry] = useState<string>(ALL)
  const [selected, setSelected] = useState<Member | null>(null)
  const deferredQuery = useDeferredValue(query)

  // Only offer countries that actually have members, so no filter yields zero.
  const memberCountryOptions = useMemo(
    () =>
      [...new Set(members.map((m) => m.country))]
        // Value stays the canonical stored name; only the label is localized,
        // so sorting follows what the reader actually sees.
        .map((canonical) => ({ canonical, label: placeLabel(canonical, lang) }))
        .sort((a, b) => a.label.localeCompare(b.label, lang)),
    [members, lang],
  )

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const labelsFor = (ids: string[], list: { id: string; es: string; en: string; pt: string }[]) =>
      ids
        .map((id) => {
          const entry = list.find((item) => item.id === id)
          return entry ? `${entry.es} ${entry.en} ${entry.pt}` : ''
        })
        .join(' ')

    return members.filter((member) => {
      if (position !== ALL && member.position !== position) return false
      if (area !== ALL && !member.generalAreaIds.includes(area)) return false
      if (country !== ALL && member.country !== country) return false
      if (!q) return true
      // Search spans everything a visitor might reasonably type, including the
      // free-text job title and biography Allan asked for.
      return [
        member.fullName,
        member.title.es,
        member.title.en,
        member.title.pt,
        member.jobPositionName,
        member.biography,
        institutionName(member.affiliationId) ?? '',
        member.country,
        member.region,
        // Also match the localized place names, so searching "Mexico" in
        // English finds members stored under the canonical "México".
        placeLabel(member.country, lang),
        placeLabel(member.region, lang),
        labelsFor(member.interestIds, options.researchInterests),
        labelsFor(member.generalAreaIds, options.generalAreas),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [
    members,
    deferredQuery,
    position,
    area,
    country,
    options.researchInterests,
    options.generalAreas,
    institutionName,
    lang,
  ])

  const hasActiveFilters = position !== ALL || area !== ALL || country !== ALL || query !== ''

  function clearFilters() {
    setPosition(ALL)
    setArea(ALL)
    setCountry(ALL)
    setQuery('')
  }

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

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-pizarra">
            {t.directory.filterArea}
            <Select
              variant="pill"
              value={area}
              onChange={(event) => setArea(event.target.value)}
              controlClassName="bg-white/70"
            >
              <option value={ALL}>{t.directory.allAreas}</option>
              {options.generalAreas.map((option) => (
                <option key={option.id} value={option.id}>{option[lang]}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-pizarra">
            {t.directory.filterCountry}
            <Select
              variant="pill"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              controlClassName="bg-white/70"
            >
              <option value={ALL}>{t.directory.allCountries}</option>
              {memberCountryOptions.map((option) => (
                <option key={option.canonical} value={option.canonical}>{option.label}</option>
              ))}
            </Select>
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-teal underline-offset-2 hover:underline"
            >
              {t.directory.clearFilters}
            </button>
          ) : null}
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
              <MemberCard
                key={member.id}
                member={member}
                highlighted={member.id === lastAddedId}
                onOpen={setSelected}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-carbon/20 p-10 text-center text-pizarra">
            {t.directory.noResults}
          </p>
        )}
      </div>

      {selected ? <MemberDetail member={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  )
}
