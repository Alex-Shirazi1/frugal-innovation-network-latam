import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'
import { Modal } from '../ui/Modal'
import { resources, type Resource } from '../../data/resources'

const typeStyles: Record<Resource['type'], string> = {
  PDF: 'bg-teal/10 text-teal-deep',
  Guía: 'bg-verde/15 text-[#5d8523]',
  Artículo: 'bg-naranja/20 text-[#9a6206]',
  Bibliografía: 'bg-carbon/8 text-pizarra',
}

const typeCoverColors: Record<Resource['type'], string> = {
  PDF: '#168599',
  Guía: '#8ebc41',
  Artículo: '#f6a620',
  Bibliografía: '#203236',
}

/** Stylized A4 cover sheet standing in for the real PDF's first page. */
function DocumentCover({ resource }: { resource: Resource }) {
  const { lang, t } = useI18n()
  const accent = typeCoverColors[resource.type]
  return (
    <div className="relative mx-auto aspect-210/297 w-full max-w-xs overflow-hidden rounded-lg bg-white shadow-[0_12px_40px_-12px_rgba(32,50,54,0.45)] ring-1 ring-carbon/10">
      <span className="brand-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-[38%] p-6" style={{ background: accent }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/75">
          Red Latinoamericana de Innovación Frugal
        </p>
        <h4 className="mt-3 font-display text-xl font-medium uppercase leading-snug text-white">
          {resource.title[lang]}
        </h4>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[38%] p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-pizarra">
          {resource.author} · {resource.year}
        </p>
        <p className="mt-3 line-clamp-5 text-xs leading-relaxed text-pizarra">
          {resource.summary[lang]}
        </p>
        <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
          <span className="flex gap-1.5" aria-hidden="true">
            {['#168599', '#8ebc41', '#f6a620', '#e94824'].map((color) => (
              <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            ))}
          </span>
          <span
            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ background: accent }}
          >
            {t.library.types[resource.type]} · {resource.language}
          </span>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const { lang, t } = useI18n()
  // Only embed the live PDF viewer when the file actually exists and is a PDF —
  // the dev server answers missing paths with the SPA's HTML, so check the type.
  const [fileState, setFileState] = useState<'checking' | 'ready' | 'missing'>('checking')

  useEffect(() => {
    let cancelled = false
    fetch(resource.file, { method: 'HEAD' })
      .then((response) => {
        const isPdf =
          response.ok && (response.headers.get('content-type') ?? '').includes('pdf')
        if (!cancelled) setFileState(isPdf ? 'ready' : 'missing')
      })
      .catch(() => {
        if (!cancelled) setFileState('missing')
      })
    return () => {
      cancelled = true
    }
  }, [resource.file])

  const metadata = [
    { label: t.library.colAuthor, value: resource.author },
    { label: t.library.colYear, value: String(resource.year) },
    { label: t.library.colLanguage, value: resource.language },
    { label: t.library.colType, value: t.library.types[resource.type] },
  ]
  return (
    <Modal open onClose={onClose} labelledBy="resource-preview-title" wide>
      {/* Viewer toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-carbon/10 bg-carbon px-5 py-3 sm:rounded-t-3xl">
        <p className="truncate text-xs font-semibold text-blanco/80">
          <span className="mr-2 text-naranja" aria-hidden="true">▤</span>
          {resource.file.split('/').pop()}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.library.close}
          className="shrink-0 rounded-full px-2.5 py-1 text-sm text-blanco/70 transition-colors hover:bg-white/10 hover:text-blanco"
        >
          ✕
        </button>
      </div>

      <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:p-10">
        {/* Document pane: embedded scrollable PDF when the file exists, styled cover otherwise */}
        {fileState === 'ready' ? (
          <div className="flex flex-col gap-2.5">
            <object
              data={resource.file}
              type="application/pdf"
              aria-label={resource.title[lang]}
              className="h-[420px] w-full overflow-hidden rounded-xl bg-niebla ring-1 ring-carbon/10 md:h-[560px]"
            >
              <DocumentCover resource={resource} />
            </object>
            <a
              href={resource.file}
              target="_blank"
              rel="noreferrer"
              className="text-center text-xs font-semibold text-teal hover:underline"
            >
              ↗ {t.library.openInNewTab}
            </a>
          </div>
        ) : (
          <div className="rounded-2xl bg-niebla p-6 md:p-8">
            <DocumentCover resource={resource} />
            {fileState === 'missing' ? (
              <p className="mt-4 text-center text-xs text-pizarra">{t.library.previewMissing}</p>
            ) : null}
          </div>
        )}

        {/* Metadata panel */}
        <div className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-rojo">
            {t.library.previewNote}
          </p>
          <h3
            id="resource-preview-title"
            className="mt-2 font-display text-2xl font-medium uppercase leading-tight text-carbon"
          >
            {resource.title[lang]}
          </h3>
          <span className="mt-3 block h-1 w-12 rounded-full bg-teal" aria-hidden="true" />

          <p className="mt-4 text-sm leading-relaxed text-pizarra">{resource.summary[lang]}</p>

          <dl className="mt-6 divide-y divide-carbon/8 border-y border-carbon/8">
            {metadata.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="font-semibold uppercase tracking-wider text-[11px] text-pizarra">
                  {row.label}
                </dt>
                <dd className="font-semibold text-carbon">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto flex flex-col gap-2.5 pt-7">
            <a
              href={resource.file}
              download
              className="rounded-full bg-teal px-6 py-3 text-center text-sm font-bold text-blanco transition-colors hover:bg-teal-deep"
            >
              ↓ {t.library.download}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-carbon/15 px-6 py-3 text-sm font-bold text-carbon transition-colors hover:border-carbon/40"
            >
              {t.library.close}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function ResourceLibrary() {
  const { lang, t } = useI18n()
  const [query, setQuery] = useState('')
  const [previewing, setPreviewing] = useState<Resource | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return resources
    return resources.filter((resource) =>
      [resource.title.es, resource.title.en, resource.title.pt, resource.author, String(resource.year), resource.type]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [query])

  return (
    <section id="recursos" aria-labelledby="recursos-heading" className="py-(--spacing-section)">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          id="recursos-heading"
          kicker={t.library.kicker}
          title={t.library.title}
          subtitle={t.library.subtitle}
        />

        <input
          type="search"
          name="resource-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.library.searchPlaceholder}
          aria-label={t.library.searchPlaceholder}
          className="mb-6 w-full max-w-md rounded-full border border-carbon/15 bg-white px-5 py-3 text-sm outline-none transition-colors focus:border-teal"
        />

        {/* Desktop: data table. Mobile: stacked cards. */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-carbon/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-teal/25 bg-niebla/60 text-xs uppercase tracking-wider text-pizarra">
                <th scope="col" className="px-5 py-3.5 font-bold">{t.library.colTitle}</th>
                <th scope="col" className="px-3 py-3.5 font-bold">{t.library.colLanguage}</th>
                <th scope="col" className="px-3 py-3.5 font-bold">{t.library.colAuthor}</th>
                <th scope="col" className="px-3 py-3.5 font-bold">{t.library.colYear}</th>
                <th scope="col" className="px-3 py-3.5 font-bold">{t.library.colType}</th>
                <th scope="col" className="px-5 py-3.5 font-bold text-right">{t.library.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((resource) => (
                <tr key={resource.id} className="border-b border-carbon/5 last:border-0 transition-colors hover:bg-teal-tint/50">
                  <th scope="row" className="px-5 py-4 font-semibold text-carbon">{resource.title[lang]}</th>
                  <td className="px-3 py-4 text-pizarra">{resource.language}</td>
                  <td className="px-3 py-4 text-pizarra">{resource.author}</td>
                  <td className="px-3 py-4 text-pizarra">{resource.year}</td>
                  <td className="px-3 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${typeStyles[resource.type]}`}>
                      {t.library.types[resource.type]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setPreviewing(resource)}
                      className="mr-2 rounded-full border border-carbon/15 px-3.5 py-1.5 text-xs font-bold transition-colors hover:border-teal hover:text-teal"
                    >
                      {t.library.preview}
                    </button>
                    <a
                      href={resource.file}
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

        <ul className="md:hidden space-y-3">
          {filtered.map((resource) => (
            <li key={resource.id} className="rounded-xl border border-carbon/10 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold leading-snug">{resource.title[lang]}</h3>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${typeStyles[resource.type]}`}>
                  {t.library.types[resource.type]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-pizarra">
                {resource.author} · {resource.year} · {resource.language}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewing(resource)}
                  className="flex-1 rounded-full border border-carbon/15 px-3 py-2 text-xs font-bold"
                >
                  {t.library.preview}
                </button>
                <a
                  href={resource.file}
                  download
                  className="flex-1 rounded-full bg-teal px-3 py-2 text-center text-xs font-bold text-blanco"
                >
                  ↓ {t.library.download}
                </a>
              </div>
            </li>
          ))}
        </ul>

        {previewing ? <PreviewModal resource={previewing} onClose={() => setPreviewing(null)} /> : null}
      </div>
    </section>
  )
}
