import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { contentAdmin } from '../../api/adminApi'

export type ContentKind = 'initiatives' | 'bibliography'

export const editorInputClass =
  'w-full rounded-xl border border-carbon/15 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal'

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
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const check = useCallback(async () => {
    try {
      setCount(await contentAdmin.count(kind))
      setError(null)
    } catch {
      setError(`No se pudo leer la colección de ${title.toLowerCase()}.`)
    }
  }, [kind, title])

  useEffect(() => {
    void check()
  }, [check])

  async function runImport() {
    setImporting(true)
    try {
      await contentAdmin.importSeed(kind)
      await check()
      setReloadKey((key) => key + 1)
      setError(null)
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message === 'already-populated'
          ? 'La colección ya tiene contenido; recarga la página.'
          : 'No se pudo importar el contenido inicial.',
      )
    } finally {
      setImporting(false)
    }
  }

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-naranja/40 bg-naranja/10 p-4 text-sm">
        {error}
      </p>
    )
  }

  if (count === null) return <p className="text-sm text-pizarra">Cargando {title.toLowerCase()}…</p>

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-carbon/25 p-6">
        <h3 className="font-display text-lg font-semibold text-carbon">
          {title} aún no se administran aquí
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-pizarra">{importDescription}</p>
        <p className="mt-2 text-xs leading-relaxed text-pizarra">
          El sitio muestra ahora {seedCount} elemento{seedCount === 1 ? '' : 's'} incluidos en el
          código. Al importarlos se copian a la base de datos y quedan editables. El sitio público
          no cambia.
        </p>
        <button
          type="button"
          onClick={() => void runImport()}
          disabled={importing}
          className="mt-4 rounded-full bg-teal px-5 py-2 text-xs font-semibold text-blanco transition-colors hover:bg-teal-deep disabled:opacity-60"
        >
          {importing ? 'Importando…' : `Importar ${seedCount} elemento${seedCount === 1 ? '' : 's'}`}
        </button>
      </div>
    )
  }

  return <>{children({ reloadKey, onChanged: () => setReloadKey((key) => key + 1) })}</>
}
