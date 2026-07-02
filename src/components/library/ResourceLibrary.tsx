import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { SectionHeading } from '../ui/SectionHeading'
import { Modal } from '../ui/Modal'
import { resources, type Resource } from '../../data/resources'

const typeStyles: Record<Resource['type'], string> = {
  PDF: 'bg-terracota/10 text-terracota-deep',
  Guía: 'bg-verde/10 text-verde',
  Artículo: 'bg-ambar/25 text-tinta',
  Bibliografía: 'bg-tinta/8 text-tinta-suave',
}

function PreviewModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const { lang, t } = useI18n()
  return (
    <Modal open onClose={onClose} labelledBy="resource-preview-title">
      <div className="p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracota">
          {t.library.previewNote}
        </p>
        <h3 id="resource-preview-title" className="mt-2 font-display text-2xl font-semibold">
          {resource.title[lang]}
        </h3>
        <p className="mt-1 text-sm text-tinta-suave">
          {resource.author} · {resource.year} · {resource.language}
        </p>

        {/* Inline document preview surface — becomes an embedded PDF viewer once real files are migrated */}
        <div className="mt-5 rounded-2xl border border-tinta/10 bg-white p-6 md:p-8 shadow-inner">
          <div className="mx-auto max-w-md space-y-3">
            <div className="h-3 w-2/3 rounded bg-tinta/15" />
            <div className="h-3 w-full rounded bg-tinta/8" />
            <div className="h-3 w-full rounded bg-tinta/8" />
            <div className="h-3 w-5/6 rounded bg-tinta/8" />
            <p className="pt-3 text-sm leading-relaxed text-tinta-suave">{resource.summary[lang]}</p>
            <div className="h-3 w-full rounded bg-tinta/8" />
            <div className="h-3 w-4/5 rounded bg-tinta/8" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-tinta/20 px-5 py-2.5 text-sm font-semibold hover:border-tinta/40"
          >
            {t.library.close}
          </button>
          <a
            href={resource.file}
            download
            className="rounded-full bg-terracota px-5 py-2.5 text-sm font-semibold text-crema transition-colors hover:bg-terracota-deep"
          >
            ↓ {t.library.download}
          </a>
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
      [resource.title.es, resource.title.en, resource.author, String(resource.year), resource.type]
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
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.library.searchPlaceholder}
          aria-label={t.library.searchPlaceholder}
          className="mb-6 w-full max-w-md rounded-full border border-tinta/15 bg-white/70 px-5 py-3 text-sm outline-none transition-colors focus:border-terracota"
        />

        {/* Desktop: data table. Mobile: stacked cards. */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-tinta/10 bg-white/70">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-xs uppercase tracking-wider text-tinta-suave">
                <th scope="col" className="px-5 py-3.5 font-semibold">{t.library.colTitle}</th>
                <th scope="col" className="px-3 py-3.5 font-semibold">{t.library.colLanguage}</th>
                <th scope="col" className="px-3 py-3.5 font-semibold">{t.library.colAuthor}</th>
                <th scope="col" className="px-3 py-3.5 font-semibold">{t.library.colYear}</th>
                <th scope="col" className="px-3 py-3.5 font-semibold">{t.library.colType}</th>
                <th scope="col" className="px-5 py-3.5 font-semibold text-right">{t.library.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((resource) => (
                <tr key={resource.id} className="border-b border-tinta/5 last:border-0 transition-colors hover:bg-arena/50">
                  <th scope="row" className="px-5 py-4 font-semibold text-tinta">{resource.title[lang]}</th>
                  <td className="px-3 py-4 text-tinta-suave">{resource.language}</td>
                  <td className="px-3 py-4 text-tinta-suave">{resource.author}</td>
                  <td className="px-3 py-4 text-tinta-suave">{resource.year}</td>
                  <td className="px-3 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyles[resource.type]}`}>
                      {resource.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setPreviewing(resource)}
                      className="mr-2 rounded-full border border-tinta/15 px-3.5 py-1.5 text-xs font-semibold transition-colors hover:border-terracota hover:text-terracota"
                    >
                      {t.library.preview}
                    </button>
                    <a
                      href={resource.file}
                      download
                      className="rounded-full bg-tinta px-3.5 py-1.5 text-xs font-semibold text-crema transition-colors hover:bg-terracota"
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
            <li key={resource.id} className="rounded-2xl border border-tinta/10 bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold leading-snug">{resource.title[lang]}</h3>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyles[resource.type]}`}>
                  {resource.type}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-tinta-suave">
                {resource.author} · {resource.year} · {resource.language}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewing(resource)}
                  className="flex-1 rounded-full border border-tinta/15 px-3 py-2 text-xs font-semibold"
                >
                  {t.library.preview}
                </button>
                <a
                  href={resource.file}
                  download
                  className="flex-1 rounded-full bg-tinta px-3 py-2 text-center text-xs font-semibold text-crema"
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
