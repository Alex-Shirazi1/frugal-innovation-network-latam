import { useEffect, useState } from 'react'
import { contentAdmin } from '../../api/adminApi'
import { createDataSource } from '../../api'
import { initiatives as seed, type Initiative } from '../../data/initiatives'
import {
  ContentEditorShell,
  EditorField,
  editorInputClass,
} from './ContentEditorShell'

/** A blank card. `order` is filled in from the current list on save. */
function emptyInitiative(): Initiative {
  return {
    id: '',
    order: 0,
    title: { es: '', en: '', pt: '' },
    text: { es: '', en: '', pt: '' },
    url: null,
    cta: null,
  }
}

/**
 * Firestore ids come from the title, so a card is addressable and the URL of a
 * document means something when someone opens the console. Falls back to a
 * timestamp-free counter suffix on collision rather than a random string, which
 * would be unreadable.
 */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let suffix = 2
  while (taken.includes(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

interface FormProps {
  initial: Initiative
  existingIds: string[]
  nextOrder: number
  onSaved: () => void
  onCancel: () => void
}

function InitiativeForm({ initial, existingIds, nextOrder, onSaved, onCancel }: FormProps) {
  const [draft, setDraft] = useState<Initiative>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = initial.id === ''

  function set<K extends keyof Initiative>(key: K, value: Initiative[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    const titleEs = draft.title.es.trim()
    const textEs = draft.text.es.trim()
    // Spanish is the only required language — see EditableText. Without it there
    // is nothing to fall back to and the card renders blank everywhere.
    if (!titleEs || !textEs) {
      setError('El título y la descripción en español son obligatorios.')
      return
    }
    const url = draft.url?.trim() || null
    if (url && !/^https?:\/\/.+/.test(url)) {
      setError('El enlace debe empezar con https://')
      return
    }

    setSaving(true)
    try {
      await contentAdmin.saveInitiative({
        ...draft,
        id: isNew ? uniqueId(slugify(titleEs) || 'iniciativa', existingIds) : draft.id,
        order: isNew ? nextOrder : draft.order,
        title: trimText(draft.title),
        text: trimText(draft.text),
        url,
        // A link with no label renders the bare URL, so default the label to
        // the Spanish title rather than leaving it null.
        cta: url ? trimText(draft.cta ?? { es: titleEs }) : null,
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
        {isNew ? 'Nueva iniciativa' : `Editando: ${initial.title.es}`}
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
              value={draft.title.en ?? ''}
              onChange={(e) => set('title', { ...draft.title, en: e.target.value })}
            />
          </EditorField>
          <EditorField label="Título (portugués)" hint="Opcional">
            <input
              className={editorInputClass}
              value={draft.title.pt ?? ''}
              onChange={(e) => set('title', { ...draft.title, pt: e.target.value })}
            />
          </EditorField>
        </div>

        <EditorField label="Descripción (español) *">
          <textarea
            rows={2}
            className={editorInputClass}
            value={draft.text.es}
            onChange={(e) => set('text', { ...draft.text, es: e.target.value })}
          />
        </EditorField>
        <div className="grid gap-3 sm:grid-cols-2">
          <EditorField label="Descripción (inglés)" hint="Opcional">
            <textarea
              rows={2}
              className={editorInputClass}
              value={draft.text.en ?? ''}
              onChange={(e) => set('text', { ...draft.text, en: e.target.value })}
            />
          </EditorField>
          <EditorField label="Descripción (portugués)" hint="Opcional">
            <textarea
              rows={2}
              className={editorInputClass}
              value={draft.text.pt ?? ''}
              onChange={(e) => set('text', { ...draft.text, pt: e.target.value })}
            />
          </EditorField>
        </div>

        <EditorField label="Enlace" hint="Opcional. Debe empezar con https://">
          <input
            className={editorInputClass}
            placeholder="https://…"
            value={draft.url ?? ''}
            onChange={(e) => set('url', e.target.value || null)}
          />
        </EditorField>
        {draft.url ? (
          <EditorField label="Texto del enlace (español)" hint="Si se deja vacío se usa el título">
            <input
              className={editorInputClass}
              value={draft.cta?.es ?? ''}
              onChange={(e) => set('cta', { ...(draft.cta ?? { es: '' }), es: e.target.value })}
            />
          </EditorField>
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

function trimText<T extends { es: string; en?: string; pt?: string }>(value: T): T {
  // Blank optional translations are dropped rather than stored as empty
  // strings, so `localizeText` falls back instead of rendering nothing.
  const cleaned: Record<string, string> = { es: value.es.trim() }
  if (value.en?.trim()) cleaned.en = value.en.trim()
  if (value.pt?.trim()) cleaned.pt = value.pt.trim()
  return cleaned as T
}

function List({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const [items, setItems] = useState<Initiative[] | null>(null)
  const [editing, setEditing] = useState<Initiative | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void createDataSource()
      .getInitiatives()
      .then((loaded) => {
        if (!cancelled) setItems(loaded)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las iniciativas.')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function remove(item: Initiative) {
    if (!window.confirm(`¿Eliminar "${item.title.es}"? Desaparecerá del sitio público.`)) return
    try {
      await contentAdmin.deleteInitiative(item.id)
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

  const ids = items.map((i) => i.id)
  const nextOrder = items.reduce((max, i) => Math.max(max, i.order), -1) + 1

  return (
    <div className="space-y-4">
      {editing ? (
        <InitiativeForm
          key={editing.id || 'new'}
          initial={editing}
          existingIds={ids}
          nextOrder={nextOrder}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(emptyInitiative())}
          className="rounded-full bg-carbon px-5 py-2 text-xs font-semibold text-blanco hover:bg-carbon/85"
        >
          + Añadir iniciativa
        </button>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-carbon/10 bg-white/80 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-semibold">{item.title.es}</h4>
                <p className="mt-0.5 text-xs text-pizarra">{item.text.es}</p>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-teal hover:underline"
                  >
                    ↗ {item.url}
                  </a>
                ) : null}
                <p className="mt-1 text-[11px] text-pizarra/70">
                  {item.title.en ? 'EN ✓' : 'EN —'} · {item.title.pt ? 'PT ✓' : 'PT —'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="rounded-full border border-carbon/15 px-3.5 py-1.5 text-xs font-semibold text-pizarra hover:border-teal hover:text-teal"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  className="rounded-full border border-rojo/30 px-3.5 py-1.5 text-xs font-semibold text-rojo hover:bg-rojo/5"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function InitiativesEditor() {
  return (
    <ContentEditorShell
      kind="initiatives"
      title="Iniciativas"
      seedCount={seed.length}
      importDescription="Las tarjetas de Iniciativas se pueden administrar desde aquí: añadir, editar y eliminar, con título, descripción corta y enlace."
    >
      {({ reloadKey, onChanged }) => <List reloadKey={reloadKey} onChanged={onChanged} />}
    </ContentEditorShell>
  )
}
