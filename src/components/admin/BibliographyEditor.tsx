import { useEffect, useMemo, useState } from 'react'
import { contentAdmin } from '../../api/adminApi'
import { createDataSource } from '../../api'
import { bibliography as seed, type BibliographyEntry } from '../../data/bibliography'
import { useI18n } from '../../i18n/I18nContext'
import {
  ContentEditorShell,
  EditorField,
  editorInputClass,
  fill,
  rowActionClass,
  rowDestructiveActionClass,
} from './ContentEditorShell'

function emptyEntry(): BibliographyEntry {
  return {
    id: '',
    paperNumber: '',
    title: '',
    authors: '',
    year: null,
    language: 'ES',
    file: '',
    sizeKb: 0,
  }
}

interface FormProps {
  initial: BibliographyEntry
  existingIds: string[]
  onSaved: () => void
  onCancel: () => void
}

/** Which validation failed, plus the number that made it fail if relevant. */
type FormError = { kind: 'required' | 'path' | 'save' } | { kind: 'duplicate'; number: string }

function EntryForm({ initial, existingIds, onSaved, onCancel }: FormProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<BibliographyEntry>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<FormError | null>(null)
  const isNew = initial.id === ''
  const e = t.admin.editor
  const copy = t.admin.bibliography

  function set<K extends keyof BibliographyEntry>(key: K, value: BibliographyEntry[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    const paperNumber = draft.paperNumber.trim()
    const title = draft.title.trim()
    const file = draft.file.trim()
    if (!paperNumber || !title || !file) {
      setError({ kind: 'required' })
      return
    }
    /*
     * `file` is a path under public/, not an upload. Uploading PDFs needs
     * Firebase Storage, which is a separate piece of work; until then an entry
     * points at a document that has to be deployed with the site. Saying so
     * here is better than accepting a path that silently 404s.
     */
    if (/^https?:\/\//.test(file)) {
      setError({ kind: 'path' })
      return
    }

    const id = isNew ? `biblio-${paperNumber.padStart(3, '0')}` : draft.id
    if (isNew && existingIds.includes(id)) {
      setError({ kind: 'duplicate', number: paperNumber })
      return
    }

    setSaving(true)
    try {
      await contentAdmin.saveBibliographyEntry({
        ...draft,
        id,
        paperNumber,
        title,
        authors: draft.authors.trim(),
        file,
        year: draft.year === null || Number.isFinite(draft.year) ? draft.year : null,
      })
      onSaved()
    } catch {
      setError({ kind: 'save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-teal/40 bg-teal-tint/40 p-5">
      <h4 className="mb-3 font-display text-base font-semibold">
        {isNew ? copy.newHeading : fill(copy.editingHeading, { name: initial.paperNumber })}
      </h4>

      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <EditorField label={`${copy.numberLabel} *`}>
            <input
              className={editorInputClass}
              value={draft.paperNumber}
              onChange={(event) => set('paperNumber', event.target.value)}
              disabled={!isNew}
            />
          </EditorField>
          <EditorField label={`${copy.titleLabel} *`}>
            <input
              className={editorInputClass}
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </EditorField>
        </div>

        <EditorField label={copy.authorsLabel}>
          <input
            className={editorInputClass}
            value={draft.authors}
            onChange={(event) => set('authors', event.target.value)}
          />
        </EditorField>

        <div className="grid gap-3 sm:grid-cols-2">
          <EditorField label={copy.yearLabel} hint={copy.yearHint}>
            <input
              className={editorInputClass}
              type="number"
              value={draft.year ?? ''}
              onChange={(event) => set('year', event.target.value ? Number(event.target.value) : null)}
            />
          </EditorField>
          <EditorField label={copy.languageLabel}>
            <select
              className={editorInputClass}
              value={draft.language}
              onChange={(event) =>
                set('language', event.target.value as BibliographyEntry['language'])
              }
            >
              <option value="ES">ES</option>
              <option value="EN">EN</option>
            </select>
          </EditorField>
        </div>

        <EditorField label={`${copy.fileLabel} *`} hint={copy.fileHint}>
          <input
            className={editorInputClass}
            value={draft.file}
            onChange={(event) => set('file', event.target.value)}
            placeholder="/docs/biblio/…"
          />
        </EditorField>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-rojo">
          {error.kind === 'required'
            ? copy.requiredFields
            : error.kind === 'path'
              ? copy.filePathOnly
              : error.kind === 'duplicate'
                ? fill(copy.duplicateNumber, { number: error.number })
                : e.saveFailed}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-full bg-teal px-5 py-2 text-xs font-semibold text-blanco hover:bg-teal-deep disabled:opacity-60"
        >
          {saving ? e.saving : e.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-carbon/15 px-5 py-2 text-xs font-semibold text-pizarra hover:border-carbon/35"
        >
          {e.cancel}
        </button>
      </div>
    </div>
  )
}

function List({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const { t } = useI18n()
  const [items, setItems] = useState<BibliographyEntry[] | null>(null)
  const [editing, setEditing] = useState<BibliographyEntry | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<'load' | 'delete' | null>(null)
  const e = t.admin.editor
  const copy = t.admin.bibliography

  useEffect(() => {
    let cancelled = false
    void createDataSource()
      .getBibliography()
      .then((loaded) => {
        if (!cancelled) setItems(loaded)
      })
      .catch(() => {
        if (!cancelled) setError('load')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // 43 entries is already too many to scan, and the list only grows.
  const shown = useMemo(() => {
    if (!items) return []
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((entry) =>
      `${entry.paperNumber} ${entry.title} ${entry.authors}`.toLowerCase().includes(q),
    )
  }, [items, query])

  async function remove(entry: BibliographyEntry) {
    if (!window.confirm(fill(e.deleteConfirm, { name: entry.title }))) return
    try {
      await contentAdmin.deleteBibliographyEntry(entry.id)
      onChanged()
    } catch {
      setError('delete')
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-rojo">
        {error === 'load' ? copy.loadFailed : e.deleteFailed}
      </p>
    )
  }
  if (!items) return <p className="text-sm text-pizarra">{e.loading}</p>

  return (
    <div className="space-y-4">
      {editing ? (
        <EntryForm
          key={editing.id || 'new'}
          initial={editing}
          existingIds={items.map((i) => i.id)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(emptyEntry())}
            className="rounded-full bg-carbon px-5 py-2 text-xs font-semibold text-blanco hover:bg-carbon/85"
          >
            {copy.add}
          </button>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            className="min-w-0 flex-1 rounded-full border border-carbon/15 bg-white px-4 py-2 text-xs outline-none focus:border-teal"
          />
        </div>
      )}

      <p className="text-xs text-pizarra" role="status">
        {fill(copy.countShown, { shown: shown.length, total: items.length })}
      </p>

      <ul className="space-y-2">
        {shown.map((entry) => (
          <li
            key={entry.id}
            /* See the note in InitiativesEditor: flex-wrap dropped the whole
               button group onto its own line whenever a title ran long, so
               rows disagreed with each other down the list. */
            className="flex flex-col gap-3 rounded-xl border border-carbon/10 bg-white/80 p-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                <span className="text-pizarra">{entry.paperNumber}</span> · {entry.title}
              </p>
              <p className="mt-0.5 text-xs text-pizarra">
                {entry.authors || '—'} · {entry.year ?? copy.noYear} · {entry.language}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-pizarra/70">{entry.file}</p>
            </div>
            <div className="flex shrink-0 gap-2 self-start">
              <button type="button" onClick={() => setEditing(entry)} className={rowActionClass}>
                {e.edit}
              </button>
              <button
                type="button"
                onClick={() => void remove(entry)}
                className={rowDestructiveActionClass}
              >
                {e.remove}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BibliographyEditor() {
  const { t } = useI18n()
  return (
    <ContentEditorShell
      kind="bibliography"
      title={t.admin.bibliography.sectionName}
      seedCount={seed.length}
      importDescription={t.admin.bibliography.importDescription}
    >
      {({ reloadKey, onChanged }) => <List reloadKey={reloadKey} onChanged={onChanged} />}
    </ContentEditorShell>
  )
}
