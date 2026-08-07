import { useDeferredValue, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useCapture } from '../../lib/analytics'
import type { BibliographyEntry } from '../../data/bibliography'
import { useApiData } from '../../api/ApiDataContext'
import { Select } from '../ui/Select'

type SortKey = 'newest' | 'oldest' | 'title' | 'number'
const ALL = 'all'

/** Rendered up front; the rest is behind an explicit expand. */
const INITIAL_VISIBLE = 12

/**
 * The network's academic bibliography — 43 papers that previously lived as a
 * raw Google Drive folder of numbered PDFs plus a separate spreadsheet you had
 * to cross-reference. Allan's words in the kickoff: "I open here and boom,
 * there's all these documents, and then I have to go to article compilation to
 * take a look at what are the... so it's a pain."
 *
 * So this is deliberately a dense, sortable catalogue rather than 43 large
 * cards: at this count the job is scanning and finding, not browsing.
 */
export function BibliographyList({ onPreview }: { onPreview?: (entry: BibliographyEntry) => void }) {
  // Firestore when the network has populated it, the bundled seed otherwise.
  const { bibliography } = useApiData()
  const { t, lang } = useI18n()
  const capture = useCapture()
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<string>(ALL)
  const [sort, setSort] = useState<SortKey>('number')
  const [expanded, setExpanded] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const rows = bibliography.filter((entry) => {
      if (language !== ALL && entry.language !== language) return false
      if (!q) return true
      return [entry.title, entry.authors, entry.paperNumber, String(entry.year ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })

    const sorted = [...rows]
    if (sort === 'newest') {
      // Undated entries sort last rather than being treated as year zero.
      sorted.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity))
    } else if (sort === 'oldest') {
      sorted.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity))
    } else if (sort === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, lang))
    } else {
      sorted.sort((a, b) => a.paperNumber.localeCompare(b.paperNumber))
    }
    return sorted
  }, [bibliography, deferredQuery, language, sort, lang])

  const hasFilters = query !== '' || language !== ALL
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_VISIBLE)
  const total = bibliography.length

  function open(entry: BibliographyEntry) {
    capture('biblio_opened', {
      paper: entry.paperNumber,
      year: entry.year ?? undefined,
      language: entry.language,
    })
    onPreview?.(entry)
  }

  return (
    <div className="mt-16">
      <h3 className="font-display text-2xl font-medium uppercase tracking-wide text-carbon md:text-3xl">
        {t.biblio.title}
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-pizarra">
        {t.biblio.subtitle.replace('{count}', String(total))}
      </p>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          name="biblio-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.biblio.searchPlaceholder}
          aria-label={t.biblio.searchPlaceholder}
          className="w-full max-w-sm rounded-full border border-carbon/15 bg-white px-5 py-2.5 text-sm outline-none transition-colors focus:border-teal"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            variant="pill"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label={t.biblio.colLang}
          >
            <option value={ALL}>{t.biblio.allLanguages}</option>
            <option value="EN">EN</option>
            <option value="ES">ES</option>
          </Select>
          <Select
            variant="pill"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label={t.biblio.sortNewest}
          >
            <option value="number">{t.biblio.sortNumber}</option>
            <option value="newest">{t.biblio.sortNewest}</option>
            <option value="oldest">{t.biblio.sortOldest}</option>
            <option value="title">{t.biblio.sortTitle}</option>
          </Select>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setLanguage(ALL)
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-teal hover:underline"
            >
              {t.biblio.clear}
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-sm text-pizarra" role="status">
        {t.biblio.showing} {filtered.length} {t.biblio.of} {total} {t.biblio.documents}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-carbon/20 p-10 text-center text-sm text-pizarra">
          {t.biblio.noResults}
        </p>
      ) : (
        <>
          {/* Desktop: dense table. Mobile: stacked rows. */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border border-carbon/10 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-teal/25 bg-niebla/60 text-xs uppercase tracking-wider text-pizarra">
                  <th scope="col" className="px-5 py-3.5 font-bold">{t.biblio.colNumber}</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">{t.biblio.colTitle}</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">{t.biblio.colAuthors}</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">{t.biblio.colYear}</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">{t.biblio.colLang}</th>
                  <th scope="col" className="w-44 px-5 py-3.5 text-right font-bold">
                    {t.library.colActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-carbon/5 last:border-0 transition-colors hover:bg-teal-tint/50"
                  >
                    <td className="px-5 py-4 font-mono text-xs text-pizarra">{entry.paperNumber}</td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        onClick={() => open(entry)}
                        className="text-left font-semibold text-carbon transition-colors hover:text-teal"
                      >
                        {entry.title}
                      </button>
                    </td>
                    <td className="px-3 py-4 text-pizarra">{entry.authors}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-pizarra">
                      {entry.year ?? t.biblio.noYear}
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-carbon/8 px-2.5 py-1 text-xs font-bold text-pizarra">
                        {entry.language}
                      </span>
                    </td>
                    <td className="w-44 px-5 py-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => open(entry)}
                        className="mr-2 rounded-full border border-carbon/15 px-3.5 py-1.5 text-xs font-bold transition-colors hover:border-teal hover:text-teal"
                      >
                        {t.library.preview}
                      </button>
                      <a
                        href={entry.file}
                        download
                        className="rounded-full bg-teal px-3.5 py-1.5 text-xs font-bold text-blanco transition-colors hover:bg-teal-deep"
                      >
                        ↓ PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 md:hidden">
            {visible.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-carbon/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[11px] text-pizarra">{entry.paperNumber}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-pizarra ring-1 ring-carbon/15">
                    {entry.language}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => open(entry)}
                  className="mt-1.5 block text-left text-sm font-semibold text-carbon hover:text-teal"
                >
                  {entry.title}
                </button>
                <p className="mt-1 text-xs text-pizarra">{entry.authors}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-xs text-pizarra">
                    {entry.year ?? t.biblio.noYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => open(entry)}
                    className="rounded-full border border-carbon/15 px-3.5 py-1.5 text-xs font-bold transition-colors hover:border-teal hover:text-teal"
                  >
                    {t.library.preview}
                  </button>
                  <a
                    href={entry.file}
                    download
                    className="rounded-full bg-teal px-3.5 py-1.5 text-xs font-bold text-blanco"
                  >
                    ↓ PDF
                  </a>
                </div>
              </li>
            ))}
          </ul>

          {filtered.length > INITIAL_VISIBLE ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-5 rounded-full border border-carbon/20 px-6 py-2.5 text-sm font-semibold text-carbon transition-colors hover:border-teal hover:text-teal"
            >
              {expanded
                ? t.biblio.showLess
                : t.biblio.showAll.replace('{count}', String(filtered.length))}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}
