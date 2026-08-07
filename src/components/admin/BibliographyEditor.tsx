import { useEffect, useMemo, useState } from 'react'
import { contentAdmin } from '../../api/adminApi'
import { createDataSource } from '../../api'
import { bibliography as seed, type BibliographyEntry } from '../../data/bibliography'
import {
  ContentEditorShell,
  EditorField,
  editorInputClass,
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

function EntryForm({ initial, existingIds, onSaved, onCancel }: FormProps) {
  const [draft, setDraft] = useState<BibliographyEntry>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = initial.id === ''

  function set<K extends keyof BibliographyEntry>(key: K, value: BibliographyEntry[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    const paperNumber = draft.paperNumber.trim()
    const title = draft.title.trim()
    const file = draft.file.trim()
    if (!paperNumber || !title || !file) {
      setError('Número, título y archivo son obligatorios.')
      return
    }
    /*
     * `file` is a path under public/, not an upload. Uploading PDFs needs
     * Firebase Storage, which is a separate piece of work; until then an entry
     * points at a document that has to be deployed with the site. Saying so
     * here is better than accepting a path that silently 404s.
     */
    if (/^https?:\/\//.test(file)) {
      setError('El archivo debe ser una ruta dentro del sitio, no una URL completa.')
      return
    }

    const id = isNew ? `biblio-${paperNumber.padStart(3, '0')}` : draft.id
    if (isNew && existingIds.includes(id)) {
      setError(`Ya existe una entrada con el número ${paperNumber}.`)
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
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-teal/40 bg-teal-tint/40 p-5">
      <h4 className="mb-3 font-display text-base font-semibold">
        {isNew ? 'Nueva entrada' : `Editando: ${initial.paperNumber}`}
      </h4>

      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <EditorField label="Número *">
            <input
              className={editorInputClass}
              value={draft.paperNumber}
              onChange={(e) => set('paperNumber', e.target.value)}
              disabled={!isNew}
            />
          </EditorField>
          <EditorField label="Título *">
            <input
              className={editorInputClass}
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </EditorField>
        </div>

        <EditorField label="Autoría">
          <input
            className={editorInputClass}
            value={draft.authors}
            onChange={(e) => set('authors', e.target.value)}
          />
        </EditorField>

        <div className="grid gap-3 sm:grid-cols-2">
          <EditorField label="Año" hint="Vacío si el documento no lo indica">
            <input
              className={editorInputClass}
              type="number"
              value={draft.year ?? ''}
              onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)}
            />
          </EditorField>
          <EditorField label="Idioma">
            <select
              className={editorInputClass}
              value={draft.language}
              onChange={(e) => set('language', e.target.value as BibliographyEntry['language'])}
            >
              <option value="ES">ES</option>
              <option value="EN">EN</option>
            </select>
          </EditorField>
        </div>

        <EditorField
          label="Archivo *"
          hint="Ruta dentro del sitio, p. ej. /docs/biblio/001.pdf. La subida de archivos aún no está disponible."
        >
          <input
            className={editorInputClass}
            value={draft.file}
            onChange={(e) => set('file', e.target.value)}
            placeholder="/docs/biblio/…"
          />
        </EditorField>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-rojo">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-full bg-teal px-5 py-2 text-xs font-semibold text-blanco hover:bg-teal-deep disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-carbon/15 px-5 py-2 text-xs font-semibold text-pizarra hover:border-carbon/35"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function List({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const [items, setItems] = useState<BibliographyEntry[] | null>(null)
  const [editing, setEditing] = useState<BibliographyEntry | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void createDataSource()
      .getBibliography()
      .then((loaded) => {
        if (!cancelled) setItems(loaded)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la bibliografía.')
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
    if (!window.confirm(`¿Eliminar "${entry.title}"? Desaparecerá del sitio público.`)) return
    try {
      await contentAdmin.deleteBibliographyEntry(entry.id)
      onChanged()
    } catch {
      setError('No se pudo eliminar.')
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-rojo">
        {error}
      </p>
    )
  }
  if (!items) return <p className="text-sm text-pizarra">Cargando…</p>

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
            + Añadir entrada
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, título o autoría…"
            aria-label="Buscar en la bibliografía"
            className="min-w-0 flex-1 rounded-full border border-carbon/15 bg-white px-4 py-2 text-xs outline-none focus:border-teal"
          />
        </div>
      )}

      <p className="text-xs text-pizarra" role="status">
        {shown.length} de {items.length} entradas
      </p>

      <ul className="space-y-2">
        {shown.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-carbon/10 bg-white/80 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <span className="text-pizarra">{entry.paperNumber}</span> · {entry.title}
              </p>
              <p className="mt-0.5 text-xs text-pizarra">
                {entry.authors || '—'} · {entry.year ?? 's. f.'} · {entry.language}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-pizarra/70">{entry.file}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditing(entry)}
                className="rounded-full border border-carbon/15 px-3 py-1.5 text-xs font-semibold text-pizarra hover:border-teal hover:text-teal"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void remove(entry)}
                className="rounded-full border border-rojo/30 px-3 py-1.5 text-xs font-semibold text-rojo hover:bg-rojo/5"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BibliographyEditor() {
  return (
    <ContentEditorShell
      kind="bibliography"
      title="Bibliografía"
      seedCount={seed.length}
      importDescription="La bibliografía se puede administrar desde aquí: añadir, editar y eliminar entradas del listado académico."
    >
      {({ reloadKey, onChanged }) => <List reloadKey={reloadKey} onChanged={onChanged} />}
    </ContentEditorShell>
  )
}
