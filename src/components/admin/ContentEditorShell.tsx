import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { contentAdmin, type ContentCollection } from '../../api/adminApi'
import { useI18n } from '../../i18n/I18nContext'

/** Fills `{placeholder}` slots in a translated string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

/**
 * Re-exported under the name the editors already import. One definition, in
 * adminApi, so the shell and the API cannot disagree about which collections
 * exist.
 */
export type ContentKind = ContentCollection

export const editorInputClass =
  'w-full rounded-xl border border-carbon/15 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal'

/**
 * The per-row actions, defined once so the two lists cannot drift apart.
 *
 * `min-w` matters more than it looks: without it the pair is as wide as its
 * labels, so the column jogs left and right between languages ("Edit/Delete"
 * against "Editar/Eliminar" against "Editar/Excluir"). A floor plus centred
 * text keeps the pair reading as one column in all three.
 */
export const rowActionClass =
  'min-w-[4.75rem] rounded-full border border-carbon/15 px-3.5 py-1.5 text-center text-xs font-semibold text-pizarra transition-colors hover:border-teal hover:text-teal'

export const rowDestructiveActionClass =
  'min-w-[4.75rem] rounded-full border border-rojo/30 px-3.5 py-1.5 text-center text-xs font-semibold text-rojo transition-colors hover:bg-rojo/5'

export function EditorField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-carbon">{label}</span>
      {hint ? <span className="mb-1 block text-[11px] text-pizarra">{hint}</span> : null}
      {children}
    </label>
  )
}

interface ContentEditorShellProps {
  kind: ContentKind
  /** What the section is called in the panel, e.g. "Iniciativas". */
  title: string
  /** Explains what importing copies, in the network's own terms. */
  importDescription: string
  seedCount: number
  children: (state: { reloadKey: number; onChanged: () => void }) => ReactNode
}

/**
 * Wraps a content editor with the import gate.
 *
 * Both editable collections fall back to the bundled seed while they are empty,
 * which means the site can be showing content that has no documents behind it.
 * Editing in that state is a trap: the first save makes the collection
 * non-empty, the fallback stops applying, and every card that was not saved
 * disappears from the live site. So nothing is editable until the seed has been
 * imported, and the panel says so plainly rather than letting someone discover
 * it by deleting five cards by accident.
 */
export function ContentEditorShell({
  kind,
  title,
  importDescription,
  seedCount,
  children,
}: ContentEditorShellProps) {
  const { t } = useI18n()
  const [count, setCount] = useState<number | null>(null)
  // Which failure, not what to say about it — a message stored here would be
  // frozen in whichever language raised it and survive a language switch.
  const [failure, setFailure] = useState<'count' | 'import' | 'populated' | null>(null)
  const [importing, setImporting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const check = useCallback(async () => {
    try {
      setCount(await contentAdmin.count(kind))
      setFailure(null)
    } catch {
      setFailure('count')
    }
  }, [kind])

  useEffect(() => {
    void check()
  }, [check])

  async function runImport() {
    setImporting(true)
    try {
      await contentAdmin.importSeed(kind)
      await check()
      setReloadKey((key) => key + 1)
      setFailure(null)
    } catch (err: unknown) {
      setFailure(
        err instanceof Error && err.message === 'already-populated' ? 'populated' : 'import',
      )
    } finally {
      setImporting(false)
    }
  }

  if (failure) {
    const message =
      failure === 'count'
        ? fill(t.admin.editor.countFailed, { section: title.toLowerCase() })
        : failure === 'populated'
          ? t.admin.editor.alreadyPopulated
          : t.admin.editor.importFailed
    return (
      <p role="alert" className="rounded-xl border border-naranja/40 bg-naranja/10 p-4 text-sm">
        {message}
      </p>
    )
  }

  if (count === null) {
    return (
      <p className="text-sm text-pizarra">
        {fill(t.admin.editor.loadingSection, { section: title.toLowerCase() })}
      </p>
    )
  }

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-carbon/25 p-6">
        <h3 className="font-display text-lg font-semibold text-carbon">
          {fill(t.admin.editor.importHeading, { section: title })}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-pizarra">{importDescription}</p>
        <p className="mt-2 text-xs leading-relaxed text-pizarra">
          {fill(t.admin.editor.importCountNote, { count: seedCount })}
        </p>
        <button
          type="button"
          onClick={() => void runImport()}
          disabled={importing}
          className="mt-4 rounded-full bg-teal px-5 py-2 text-xs font-semibold text-blanco transition-colors hover:bg-teal-deep disabled:opacity-60"
        >
          {importing
            ? t.admin.editor.importing
            : fill(t.admin.editor.importAction, { count: seedCount })}
        </button>
      </div>
    )
  }

  return <>{children({ reloadKey, onChanged: () => setReloadKey((key) => key + 1) })}</>
}
