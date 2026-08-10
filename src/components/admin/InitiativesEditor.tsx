import { useEffect, useState } from 'react'
import { contentAdmin } from '../../api/adminApi'
import { createDataSource } from '../../api'
import { initiatives as seed, localizeText, type Initiative } from '../../data/initiatives'
import { useI18n } from '../../i18n/I18nContext'
import type { ContentLang, LocalisedText } from '../../lib/translate'
import { CompleteLanguagesButton, MachineTranslatedNote } from './TranslateControls'
import {
  ContentEditorShell,
  EditorField,
  editorInputClass,
  fill,
  rowActionClass,
  rowDestructiveActionClass,
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
  const { t } = useI18n()
  const [draft, setDraft] = useState<Initiative>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<'required' | 'link' | 'save' | null>(null)
  const isNew = initial.id === ''
  const e = t.admin.editor
  const copy = t.admin.initiatives

  /**
   * Which fields a machine wrote, so the note can appear under exactly those.
   * Component state, not stored: it is a prompt to read the text before saving,
   * not a property of the record.
   */
  const [machine, setMachine] = useState<Record<'title' | 'text', Set<ContentLang>>>({
    title: new Set(),
    text: new Set(),
  })

  function set<K extends keyof Initiative>(key: K, value: Initiative[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  /** Applies a translation result to one field group and flags what it filled. */
  function applyTranslation(field: 'title' | 'text', values: LocalisedText) {
    setDraft((prev) => ({ ...prev, [field]: { ...prev[field], ...values } }))
    setMachine((prev) => ({
      ...prev,
      [field]: new Set([...prev[field], ...(Object.keys(values) as ContentLang[])]),
    }))
  }

  /** Typing over a machine translation makes it the author's text again. */
  function setTranslated(field: 'title' | 'text', lang: ContentLang, value: string) {
    set(field, { ...draft[field], [lang]: value })
    setMachine((prev) => {
      if (!prev[field].has(lang)) return prev
      const next = new Set(prev[field])
      next.delete(lang)
      return { ...prev, [field]: next }
    })
  }

  async function save() {
    const titleEs = draft.title.es.trim()
    const textEs = draft.text.es.trim()
    // Spanish is the only required language — see EditableText. Without it there
    // is nothing to fall back to and the card renders blank everywhere.
    if (!titleEs || !textEs) {
      setError('required')
      return
    }
    const url = draft.url?.trim() || null
    if (url && !/^https?:\/\/.+/.test(url)) {
      setError('link')
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
      setError('save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-teal/40 bg-teal-tint/40 p-5">
      <h4 className="mb-3 font-display text-base font-semibold">
        {isNew ? copy.newHeading : fill(copy.editingHeading, { name: initial.title.es })}
      </h4>

      <div className="grid gap-3">
        <EditorField label={`${copy.titleLabel} (${e.inSpanish}) *`}>
          <input
            className={editorInputClass}
            value={draft.title.es}
            onChange={(event) => setTranslated('title', 'es', event.target.value)}
          />
          {machine.title.has('es') ? <MachineTranslatedNote /> : null}
        </EditorField>
        <CompleteLanguagesButton
          value={draft.title}
          onFilled={(values) => applyTranslation('title', values)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <EditorField label={`${copy.titleLabel} (${e.inEnglish})`} hint={e.optionalFallsBack}>
            <input
              className={editorInputClass}
              value={draft.title.en ?? ''}
              onChange={(event) => setTranslated('title', 'en', event.target.value)}
            />
            {machine.title.has('en') ? <MachineTranslatedNote /> : null}
          </EditorField>
          <EditorField label={`${copy.titleLabel} (${e.inPortuguese})`} hint={e.optional}>
            <input
              className={editorInputClass}
              value={draft.title.pt ?? ''}
              onChange={(event) => setTranslated('title', 'pt', event.target.value)}
            />
            {machine.title.has('pt') ? <MachineTranslatedNote /> : null}
          </EditorField>
        </div>

        <EditorField label={`${copy.descriptionLabel} (${e.inSpanish}) *`}>
          <textarea
            rows={2}
            className={editorInputClass}
            value={draft.text.es}
            onChange={(event) => setTranslated('text', 'es', event.target.value)}
          />
          {machine.text.has('es') ? <MachineTranslatedNote /> : null}
        </EditorField>
        <CompleteLanguagesButton
          value={draft.text}
          onFilled={(values) => applyTranslation('text', values)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <EditorField label={`${copy.descriptionLabel} (${e.inEnglish})`} hint={e.optional}>
            <textarea
              rows={2}
              className={editorInputClass}
              value={draft.text.en ?? ''}
              onChange={(event) => setTranslated('text', 'en', event.target.value)}
            />
            {machine.text.has('en') ? <MachineTranslatedNote /> : null}
          </EditorField>
          <EditorField label={`${copy.descriptionLabel} (${e.inPortuguese})`} hint={e.optional}>
            <textarea
              rows={2}
              className={editorInputClass}
              value={draft.text.pt ?? ''}
              onChange={(event) => setTranslated('text', 'pt', event.target.value)}
            />
            {machine.text.has('pt') ? <MachineTranslatedNote /> : null}
          </EditorField>
        </div>

        <EditorField label={copy.linkLabel} hint={copy.linkHint}>
          <input
            className={editorInputClass}
            placeholder="https://…"
            value={draft.url ?? ''}
            onChange={(event) => set('url', event.target.value || null)}
          />
        </EditorField>
        {draft.url ? (
          <EditorField label={copy.ctaLabel} hint={copy.ctaHint}>
            <input
              className={editorInputClass}
              value={draft.cta?.es ?? ''}
              onChange={(event) =>
                set('cta', { ...(draft.cta ?? { es: '' }), es: event.target.value })
              }
            />
          </EditorField>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-rojo">
          {error === 'required'
            ? copy.requiredSpanish
            : error === 'link'
              ? copy.linkInvalid
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

function trimText<T extends { es: string; en?: string; pt?: string }>(value: T): T {
  // Blank optional translations are dropped rather than stored as empty
  // strings, so `localizeText` falls back instead of rendering nothing.
  const cleaned: Record<string, string> = { es: value.es.trim() }
  if (value.en?.trim()) cleaned.en = value.en.trim()
  if (value.pt?.trim()) cleaned.pt = value.pt.trim()
  return cleaned as T
}

function List({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const { lang, t } = useI18n()
  const [items, setItems] = useState<Initiative[] | null>(null)
  const [editing, setEditing] = useState<Initiative | null>(null)
  const [error, setError] = useState<'load' | 'delete' | null>(null)
  const e = t.admin.editor
  const copy = t.admin.initiatives

  useEffect(() => {
    let cancelled = false
    void createDataSource()
      .getInitiatives()
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

  async function remove(item: Initiative) {
    if (!window.confirm(fill(e.deleteConfirm, { name: localizeText(item.title, lang) }))) return
    try {
      await contentAdmin.deleteInitiative(item.id)
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
          {copy.add}
        </button>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-carbon/10 bg-white/80 p-4"
          >
            {/* Not flex-wrap: a wrapping row lets the whole button group drop
                to the next line as soon as the text is long, so rows with a
                long URL looked different from rows without one. Wrapping is
                decided by the breakpoint instead — stacked below sm, inline
                above it — so every row in the list agrees. `min-w-0 flex-1`
                is what lets the text shrink and truncate rather than shove. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {/* Shows the chosen language, falling back to Spanish — the
                    list used to read `.es` regardless, so an English reviewer
                    could not tell which card they were about to edit. */}
                <h4 className="font-semibold">{localizeText(item.title, lang)}</h4>
                <p className="mt-0.5 text-xs text-pizarra">{localizeText(item.text, lang)}</p>
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
              <div className="flex shrink-0 gap-2 self-start">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className={rowActionClass}
                >
                  {e.edit}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  className={rowDestructiveActionClass}
                >
                  {e.remove}
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
  const { t } = useI18n()
  return (
    <ContentEditorShell
      kind="initiatives"
      title={t.admin.initiatives.sectionName}
      seedCount={seed.length}
      importDescription={t.admin.initiatives.importDescription}
    >
      {({ reloadKey, onChanged }) => <List reloadKey={reloadKey} onChanged={onChanged} />}
    </ContentEditorShell>
  )
}
