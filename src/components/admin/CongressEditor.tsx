import { useEffect, useState } from 'react'
import { contentAdmin } from '../../api/adminApi'
import { createDataSource } from '../../api'
import type { Congress } from '../../data/congress'
import type { EditableText } from '../../data/initiatives'
import { EditorField, editorInputClass } from './ContentEditorShell'

/**
 * The congress card.
 *
 * No import gate here, unlike the collections: this is one document, so there
 * is no "some of it exists" state to get wrong. Saving writes the whole block,
 * and until someone does the site renders the seed.
 *
 * Allan called editing this low priority — the congress happens once a year and
 * the next one is months away — so it is a plain form rather than anything
 * clever. The dates and the destination change annually; that is the point.
 */
const FIELDS: Array<{ key: keyof Omit<Congress, 'siteUrl'>; label: string; hint?: string }> = [
  { key: 'kicker', label: 'Antetítulo', hint: 'La línea pequeña sobre el título' },
  { key: 'title', label: 'Título' },
  { key: 'subtitle', label: 'Descripción' },
  { key: 'details', label: 'Fechas y lugar', hint: 'Una sola línea, p. ej. 27–29 de mayo de 2026 · Bogotá, Colombia' },
  { key: 'siteCta', label: 'Texto del botón' },
]

export function CongressEditor() {
  const [draft, setDraft] = useState<Congress | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void createDataSource()
      .getCongress()
      .then((value) => {
        if (!cancelled) setDraft(value)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la información del congreso.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setText(key: keyof Omit<Congress, 'siteUrl'>, lang: keyof EditableText, value: string) {
    setSaved(false)
    setDraft((prev) => (prev ? { ...prev, [key]: { ...prev[key], [lang]: value } } : prev))
  }

  async function save() {
    if (!draft) return
    for (const field of FIELDS) {
      if (!draft[field.key].es?.trim()) {
        setError(`Falta "${field.label}" en español.`)
        return
      }
    }
    if (!/^https?:\/\/.+/.test(draft.siteUrl.trim())) {
      setError('El enlace del congreso debe empezar con https://')
      return
    }

    setSaving(true)
    try {
      await contentAdmin.saveCongress({
        ...draft,
        siteUrl: draft.siteUrl.trim(),
      })
      setSaved(true)
      setError(null)
    } catch {
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (error && !draft) {
    return (
      <p role="alert" className="text-sm text-rojo">
        {error}
      </p>
    )
  }
  if (!draft) return <p className="text-sm text-pizarra">Cargando…</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-pizarra">
        Esta tarjeta se actualiza cada año. El español es obligatorio; si falta inglés o portugués
        se muestra el español.
      </p>

      {FIELDS.map((field) => (
        <div key={field.key} className="rounded-2xl border border-carbon/10 bg-white/80 p-4">
          <EditorField label={`${field.label} (español) *`} hint={field.hint}>
            <input
              className={editorInputClass}
              value={draft[field.key].es ?? ''}
              onChange={(e) => setText(field.key, 'es', e.target.value)}
            />
          </EditorField>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <EditorField label="Inglés">
              <input
                className={editorInputClass}
                value={draft[field.key].en ?? ''}
                onChange={(e) => setText(field.key, 'en', e.target.value)}
              />
            </EditorField>
            <EditorField label="Portugués">
              <input
                className={editorInputClass}
                value={draft[field.key].pt ?? ''}
                onChange={(e) => setText(field.key, 'pt', e.target.value)}
              />
            </EditorField>
          </div>
        </div>
      ))}

      <div className="rounded-2xl border border-carbon/10 bg-white/80 p-4">
        <EditorField label="Enlace del sitio del congreso *">
          <input
            className={editorInputClass}
            value={draft.siteUrl}
            onChange={(e) => {
              setSaved(false)
              setDraft({ ...draft, siteUrl: e.target.value })
            }}
          />
        </EditorField>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-rojo">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-xs font-medium text-verde">
          Guardado. El sitio público ya muestra estos cambios.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-full bg-teal px-5 py-2 text-xs font-semibold text-blanco hover:bg-teal-deep disabled:opacity-60"
      >
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
