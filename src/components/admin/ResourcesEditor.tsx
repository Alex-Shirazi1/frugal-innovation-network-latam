import { useEffect, useState } from 'react'
import { contentAdmin } from '../../api/adminApi'
import { createDataSource } from '../../api'
import { resources as seed, type Resource } from '../../data/resources'
import { ContentEditorShell, EditorField, editorInputClass } from './ContentEditorShell'
import { isExternalDocument } from '../library/ResourceLibrary'

const TYPES: Resource['type'][] = ['PDF', 'Guía', 'Artículo', 'Bibliografía']
const LANGS: Resource['language'][] = ['ES', 'EN', 'PT']

function emptyResource(): Resource {
  return {
    id: '',
    title: { es: '', en: '', pt: '' },
    language: 'ES',
    author: '',
    year: new Date().getFullYear(),
    type: 'PDF',
    file: '',
    summary: { es: '', en: '', pt: '' },
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

interface FormProps {
  initial: Resource
  existingIds: string[]
  onSaved: () => void
  onCancel: () => void
}

function ResourceForm({ initial, existingIds, onSaved, onCancel }: FormProps) {
  const [draft, setDraft] = useState<Resource>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = initial.id === ''

  function set<K extends keyof Resource>(key: K, value: Resource[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    const titleEs = draft.title.es.trim()
    const file = draft.file.trim()
    if (!titleEs || !file) {
      setError('El título en español y el documento son obligatorios.')
      return
    }

    let id = draft.id
    if (isNew) {
      id = slugify(titleEs) || 'documento'
      if (existingIds.includes(id)) {
        setError('Ya existe un documento con ese título.')
        return
      }
    }

    setSaving(true)
    try {
      await contentAdmin.saveResource({
        ...draft,
        id,
        file,
        author: draft.author.trim(),
        title: fill(draft.title),
        summary: fill(draft.summary),
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
        {isNew ? 'Nuevo documento' : `Editando: ${initial.title.es}`}
      </h4>

      <div className="grid gap-3">
        <EditorField label="Título (español) *">
          <input
            className={editorInputClass}
            value={draft.title.es}
            onChange={(e) => set('title', { ...draft.title, es: e.target.value })}
          />
        </EditorField>
        <div className="grid gap-3 sm:grid-cols-2">
          <EditorField label="Título (inglés)" hint="Opcional — si falta se usa el español">
            <input
              className={editorInputClass}
              value={draft.title.en}
              onChange={(e) => set('title', { ...draft.title, en: e.target.value })}
            />
          </EditorField>
          <EditorField label="Título (portugués)" hint="Opcional">
            <input
              className={editorInputClass}
              value={draft.title.pt}
              onChange={(e) => set('title', { ...draft.title, pt: e.target.value })}
            />
          </EditorField>
        </div>

        <EditorField label="Resumen (español)">
          <textarea
            rows={2}
            className={editorInputClass}
            value={draft.summary.es}
            onChange={(e) => set('summary', { ...draft.summary, es: e.target.value })}
          />
        </EditorField>

        <div className="grid gap-3 sm:grid-cols-4">
          <EditorField label="Autoría">
            <input
              className={editorInputClass}
              value={draft.author}
              onChange={(e) => set('author', e.target.value)}
            />
          </EditorField>
          <EditorField label="Año">
            <input
              type="number"
              className={editorInputClass}
              value={draft.year}
              onChange={(e) => set('year', Number(e.target.value))}
            />
          </EditorField>
          <EditorField label="Idioma">
            <select
              className={editorInputClass}
              value={draft.language}
              onChange={(e) => set('language', e.target.value as Resource['language'])}
            >
              {LANGS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </EditorField>
          <EditorField label="Tipo">
            <select
              className={editorInputClass}
              value={draft.type}
              onChange={(e) => set('type', e.target.value as Resource['type'])}
            >
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </EditorField>
        </div>

        {/*
          Two kinds of destination are accepted on purpose. The 43 documents
          already in the repo are served from /docs and keep the inline preview,
          which is better than anything an embed gives us. A new document has
          nowhere to be uploaded to — Cloud Storage left the free plan in
          February 2026 — so it points at the network's Drive instead, and the
          site opens it there. Allan can add a document without a developer,
          and nothing existing gets worse.
        */}
        <EditorField
          label="Documento *"
          hint="Ruta del sitio (/docs/…) para documentos incluidos, o enlace de Google Drive para documentos nuevos."
        >
          <input
            className={editorInputClass}
            value={draft.file}
            onChange={(e) => set('file', e.target.value)}
            placeholder="/docs/… o https://drive.google.com/…"
          />
        </EditorField>
        {isExternalDocument(draft.file.trim()) ? (
          <p className="text-[11px] text-pizarra">
            Enlace externo: se abrirá en una pestaña nueva en lugar de la vista previa integrada.
          </p>
        ) : null}
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

/** Blank translations become the Spanish text rather than an empty column. */
function fill(value: { es: string; en: string; pt: string }) {
  const es = value.es.trim()
  return { es, en: value.en.trim() || es, pt: value.pt.trim() || es }
}

function List({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const [items, setItems] = useState<Resource[] | null>(null)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void createDataSource()
      .getResources()
      .then((loaded) => {
        if (!cancelled) setItems(loaded)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los documentos.')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function remove(item: Resource) {
    if (!window.confirm(`¿Eliminar "${item.title.es}"? Desaparecerá del sitio público.`)) return
    try {
      await contentAdmin.deleteResource(item.id)
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
        <ResourceForm
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
        <button
          type="button"
          onClick={() => setEditing(emptyResource())}
          className="rounded-full bg-carbon px-5 py-2 text-xs font-semibold text-blanco hover:bg-carbon/85"
        >
          + Añadir documento
        </button>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-carbon/10 bg-white/80 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.title.es}</p>
              <p className="mt-0.5 text-xs text-pizarra">
                {item.author || '—'} · {item.year} · {item.language} · {item.type}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-pizarra/70">
                {isExternalDocument(item.file) ? '↗ ' : ''}
                {item.file}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={item.file}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-carbon/15 px-3 py-1.5 text-xs font-semibold text-pizarra hover:border-teal hover:text-teal"
              >
                Ver
              </a>
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="rounded-full border border-carbon/15 px-3 py-1.5 text-xs font-semibold text-pizarra hover:border-teal hover:text-teal"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void remove(item)}
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

export function ResourcesEditor() {
  return (
    <ContentEditorShell
      kind="resources"
      title="Documentos"
      seedCount={seed.length}
      importDescription="Los documentos de la sección Recursos se pueden administrar desde aquí: añadir, editar y eliminar, con título, autoría, año e idioma."
    >
      {({ reloadKey, onChanged }) => <List reloadKey={reloadKey} onChanged={onChanged} />}
    </ContentEditorShell>
  )
}
