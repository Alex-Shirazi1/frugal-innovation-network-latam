import { useEffect, useState } from 'react'
import { contentAdmin } from '../../api/adminApi'
import { createDataSource } from '../../api'
import type { Congress } from '../../data/congress'
import type { EditableText } from '../../data/initiatives'
import { useI18n } from '../../i18n/I18nContext'
import type { ContentLang, LocalisedText } from '../../lib/translate'
import { CompleteLanguagesButton, MachineTranslatedNote } from './TranslateControls'
import { EditorField, editorInputClass, fill } from './ContentEditorShell'

/**
 * The congress card.
 *
 * No import gate here, unlike the collections: this is one document, so there
 * is no "some of it exists" state to get wrong. The form is populated from the
 * live data source — the same one the public page reads — so it opens showing
 * exactly what the site is showing. Saving writes the whole block.
 *
 * Allan called editing this low priority — the congress happens once a year and
 * the next one is months away — so it is a plain form rather than anything
 * clever. The dates and the destination change annually; that is the point.
 */
type CongressField = keyof Omit<Congress, 'siteUrl'>

/** Field order, with the translation keys for the label and optional hint. */
const FIELDS: Array<{
  key: CongressField
  labelKey: 'kickerLabel' | 'titleLabel' | 'subtitleLabel' | 'detailsLabel' | 'siteCtaLabel'
  hintKey?: 'kickerHint' | 'detailsHint'
}> = [
  { key: 'kicker', labelKey: 'kickerLabel', hintKey: 'kickerHint' },
  { key: 'title', labelKey: 'titleLabel' },
  { key: 'subtitle', labelKey: 'subtitleLabel' },
  { key: 'details', labelKey: 'detailsLabel', hintKey: 'detailsHint' },
  { key: 'siteCta', labelKey: 'siteCtaLabel' },
]

/** Which failure, not its wording — see the note in ContentEditorShell. */
type CongressError = { kind: 'load' | 'url' | 'save' } | { kind: 'missing'; field: string }

interface CongressFieldProps {
  label: string
  hint?: string
  value: EditableText
  onChange: (lang: keyof EditableText, value: string) => void
}

/**
 * One translatable field, extracted so it can own state.
 *
 * The five fields render from a list, and each needs its own record of which
 * boxes a machine wrote — so the group is a component rather than the list
 * being five copies of the same JSX.
 */
function CongressField({ label, hint, value, onChange }: CongressFieldProps) {
  const { t } = useI18n()
  const e = t.admin.editor
  const [machine, setMachine] = useState<Set<ContentLang>>(new Set())

  function apply(values: LocalisedText) {
    for (const [lang, translated] of Object.entries(values) as [ContentLang, string][]) {
      onChange(lang, translated)
    }
    setMachine((prev) => new Set([...prev, ...(Object.keys(values) as ContentLang[])]))
  }

  /** Typing over a suggestion makes it the author's text again. */
  function edit(lang: ContentLang, next: string) {
    onChange(lang, next)
    setMachine((prev) => {
      if (!prev.has(lang)) return prev
      const updated = new Set(prev)
      updated.delete(lang)
      return updated
    })
  }

  return (
    <div className="rounded-2xl border border-carbon/10 bg-white/80 p-4">
      <EditorField label={`${label} (${e.inSpanish}) *`} hint={hint}>
        <input
          className={editorInputClass}
          value={value.es ?? ''}
          onChange={(event) => edit('es', event.target.value)}
        />
        {machine.has('es') ? <MachineTranslatedNote /> : null}
      </EditorField>
      <CompleteLanguagesButton value={value} onFilled={apply} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <EditorField label={e.english}>
          <input
            className={editorInputClass}
            value={value.en ?? ''}
            onChange={(event) => edit('en', event.target.value)}
          />
          {machine.has('en') ? <MachineTranslatedNote /> : null}
        </EditorField>
        <EditorField label={e.portuguese}>
          <input
            className={editorInputClass}
            value={value.pt ?? ''}
            onChange={(event) => edit('pt', event.target.value)}
          />
          {machine.has('pt') ? <MachineTranslatedNote /> : null}
        </EditorField>
      </div>
    </div>
  )
}

export function CongressEditor() {
  const { t } = useI18n()
  const [draft, setDraft] = useState<Congress | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<CongressError | null>(null)
  const e = t.admin.editor
  const copy = t.admin.congress

  useEffect(() => {
    let cancelled = false
    void createDataSource()
      .getCongress()
      .then((value) => {
        if (!cancelled) setDraft(value)
      })
      .catch(() => {
        if (!cancelled) setError({ kind: 'load' })
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
        setError({ kind: 'missing', field: copy[field.labelKey] })
        return
      }
    }
    if (!/^https?:\/\/.+/.test(draft.siteUrl.trim())) {
      setError({ kind: 'url' })
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
      setError({ kind: 'save' })
    } finally {
      setSaving(false)
    }
  }

  const errorText = !error
    ? null
    : error.kind === 'load'
      ? copy.loadFailed
      : error.kind === 'url'
        ? copy.urlInvalid
        : error.kind === 'missing'
          ? fill(copy.missingField, { field: error.field })
          : e.saveFailed

  if (error && !draft) {
    return (
      <p role="alert" className="text-sm text-rojo">
        {errorText}
      </p>
    )
  }
  if (!draft) return <p className="text-sm text-pizarra">{e.loading}</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-pizarra">{copy.intro}</p>

      {FIELDS.map((field) => (
        <CongressField
          key={field.key}
          label={copy[field.labelKey]}
          hint={field.hintKey ? copy[field.hintKey] : undefined}
          value={draft[field.key]}
          onChange={(lang, value) => setText(field.key, lang, value)}
        />
      ))}

      <div className="rounded-2xl border border-carbon/10 bg-white/80 p-4">
        <EditorField label={`${copy.siteUrlLabel} *`}>
          <input
            className={editorInputClass}
            value={draft.siteUrl}
            onChange={(event) => {
              setSaved(false)
              setDraft({ ...draft, siteUrl: event.target.value })
            }}
          />
        </EditorField>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-rojo">
          {errorText}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-xs font-medium text-verde">
          {copy.savedNote}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-full bg-teal px-5 py-2 text-xs font-semibold text-blanco hover:bg-teal-deep disabled:opacity-60"
      >
        {saving ? e.saving : copy.saveChanges}
      </button>
    </div>
  )
}
