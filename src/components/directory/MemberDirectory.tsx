import {
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
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

/**
 * Seconds each item spends crossing the viewport. Both conveyors derive their
 * duration from this so a 54-card track and a 30-pill track travel at the same
 * apparent speed instead of the longer one sprinting to keep the same lap time.
 */
const CONVEYOR_SECONDS_PER_ITEM = 2.4

function InstitutionConveyor() {
  const { t } = useI18n()
  const { institutions } = useApiData()
  // Track is duplicated so the loop is seamless; aria-hidden on the copy.
  const names = institutions.map((i) => i.name)
  return (
    <div
      /* `motion-reduce`: with the animation off the track is just a very wide
         row, so hand the reader a scrollbar instead of clipping the tail. */
      className="conveyor overflow-hidden motion-reduce:overflow-x-auto border-y border-carbon/10 bg-white/50 py-4"
      /* `aria-label` on a bare div names nothing — a div has no implicit role
         for the label to attach to, so this strip was previously unlabelled to
         assistive tech. `group` is the right weight: it names the strip without
         claiming to be a landmark. */
      role="group"
      aria-label={t.directory.institutionsTitle}
    >
      <div
        className="conveyor-track flex w-max gap-3"
        style={{ '--conveyor-duration': `${names.length * CONVEYOR_SECONDS_PER_ITEM}s` } as CSSProperties}
      >
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

interface MemberConveyorProps {
  members: Member[]
  highlightedId: string | null
  onOpen: (member: Member) => void
  /** The section's content column, used as the width the cards must fit into. */
  columnRef: RefObject<HTMLDivElement | null>
}

/** Container classes shared with the section body, so a strip that is not
 *  scrolling starts exactly where the heading and the filters start. */
const CONTENT_COLUMN = 'mx-auto max-w-7xl px-4 md:px-8'

/**
 * The directory, always.
 *
 * Allan's note on the call was that a wall of member cards is the wrong shape
 * for this section — nobody reads 54 of them, and at 200 members it stops being
 * a page. So the strip is not a resting state that a search replaces; searching
 * and filtering just change which cards are on it.
 *
 * Motion is conditional on need: once the cards no longer reach past the
 * viewport there is nothing to scroll to, and a four-card track sliding on a
 * loop reads as a glitch. Below that threshold the strip simply sits still.
 * Hovering or tabbing in pauses the drift (see `.conveyor` in global.css),
 * which is what makes the cards clickable rather than decorative.
 */
function MemberConveyor({ members, highlightedId, onOpen, columnRef }: MemberConveyorProps) {
  const { t, lang } = useI18n()
  const listRef = useRef<HTMLUListElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const list = listRef.current
    const column = columnRef.current
    if (!list || !column) return

    /*
     * Compared against the section's own content column rather than the full
     * viewport, because that is where a non-scrolling strip is laid out — and
     * measured off the first list, never off the track, since the track is what
     * gains the duplicate copy and the column padding. Measuring the track
     * would feed this decision its own output and oscillate; the list's width
     * depends only on how many cards are in it.
     */
    // A computed padding can come back as '' (no stylesheet applied yet), and
    // parseFloat('') is NaN — which would silently make every comparison below
    // false and pin the strip to "fits" forever.
    const pixels = (value: string): number => {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const measure = () => {
      const style = getComputedStyle(column)
      const available = column.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight)
      setOverflows(list.scrollWidth > available)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    observer.observe(list)
    return () => observer.disconnect()
  }, [members, columnRef])

  const cards = (
    <>
      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          highlighted={member.id === highlightedId}
          onOpen={onOpen}
          className="w-72 shrink-0"
        />
      ))}
    </>
  )

  return (
    <div
      className="conveyor overflow-hidden motion-reduce:overflow-x-auto py-1"
      role="group"
      aria-label={t.directory.carouselLabel}
      lang={lang}
    >
      <div
        className={`flex gap-4 ${overflows ? 'conveyor-track w-max' : CONTENT_COLUMN}`}
        style={
          overflows
            ? ({
                '--conveyor-duration': `${members.length * CONVEYOR_SECONDS_PER_ITEM}s`,
              } as CSSProperties)
            : undefined
        }
      >
        <ul ref={listRef} className="flex gap-4">
          {cards}
        </ul>
        {/* The duplicate exists only to hide the loop seam, so it is pointless
            when nothing is looping. Where it is rendered, `inert` keeps its
            cards out of the tab order and out of the accessibility tree —
            otherwise a keyboard user tabs through every member twice. */}
        {overflows ? (
          <ul className="flex gap-4" aria-hidden inert>
            {cards}
          </ul>
        ) : null}
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
  const columnRef = useRef<HTMLDivElement>(null)
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

      <div ref={columnRef} className={`${CONTENT_COLUMN} pt-8`}>
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
          {/* Narrow searches routinely land on one result now that the strip
              never expands into a grid, so "1 personas" is on screen often
              enough to be worth the branch. */}
          {t.directory.showing} {filtered.length}{' '}
          {filtered.length === 1 ? t.directory.person : t.directory.people}
          {hasActiveFilters ? null : (
            <span className="block text-xs md:ml-2 md:inline">{t.directory.browseHint}</span>
          )}
        </p>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-carbon/20 p-10 text-center text-pizarra">
            {t.directory.noResults}
          </p>
        ) : null}
      </div>

      {/* Full-bleed, like the institution strip above it: a marquee pinned to the
          content column reads as a broken grid rather than as something moving.
          Searching narrows what is on the strip; it never replaces the strip. */}
      {filtered.length > 0 ? (
        <MemberConveyor
          members={filtered}
          highlightedId={lastAddedId}
          onOpen={setSelected}
          columnRef={columnRef}
        />
      ) : null}

      {selected ? <MemberDetail member={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  )
}
