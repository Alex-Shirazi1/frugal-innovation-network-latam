import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContentEditorShell } from './ContentEditorShell'
import { I18nProvider } from '../../i18n/I18nContext'

const count = vi.fn()
const importSeed = vi.fn()

vi.mock('../../api/adminApi', () => ({
  contentAdmin: {
    count: (...args: unknown[]) => count(...args),
    importSeed: (...args: unknown[]) => importSeed(...args),
  },
}))

/**
 * The shell reads its copy from the dictionary, so it needs the provider. The
 * assertions below stay in Spanish because that is the default language, which
 * is itself worth pinning: the panel must not come up in English for the people
 * who actually run the network.
 */
function renderShell() {
  return render(
    <I18nProvider>
      <ContentEditorShell
        kind="initiatives"
        title="Iniciativas"
        seedCount={6}
        importDescription="Se pueden administrar desde aquí."
      >
        {() => <p>EDITOR</p>}
      </ContentEditorShell>
    </I18nProvider>,
  )
}

beforeEach(() => {
  count.mockReset()
  importSeed.mockReset()
  window.localStorage.clear()
})

describe('ContentEditorShell', () => {
  /**
   * The trap this gate exists to prevent: the public site falls back to the
   * bundled seed while the collection is empty, so it can show six cards backed
   * by zero documents. Editing one would make the collection non-empty, the
   * fallback would stop applying, and the other five would vanish from the live
   * site. So an empty collection must not reach the editor at all.
   */
  it('withholds the editor while the collection is empty', async () => {
    count.mockResolvedValue(0)
    renderShell()

    await waitFor(() => expect(screen.getByRole('button', { name: /Importar/ })).toBeInTheDocument())
    expect(screen.queryByText('EDITOR')).not.toBeInTheDocument()
  })

  it('says how many items will be imported, so the action is not a leap of faith', async () => {
    count.mockResolvedValue(0)
    renderShell()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Importar 6 elementos' })).toBeInTheDocument(),
    )
    expect(screen.getByText(/El sitio público no cambia/)).toBeInTheDocument()
  })

  it('shows the editor once documents exist', async () => {
    count.mockResolvedValue(6)
    renderShell()

    await waitFor(() => expect(screen.getByText('EDITOR')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Importar/ })).not.toBeInTheDocument()
  })

  it('imports the seed and then hands over to the editor', async () => {
    const user = userEvent.setup()
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(6)
    importSeed.mockResolvedValue(6)
    renderShell()

    await waitFor(() => expect(screen.getByRole('button', { name: /Importar/ })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Importar/ }))

    await waitFor(() => expect(screen.getByText('EDITOR')).toBeInTheDocument())
    expect(importSeed).toHaveBeenCalledWith('initiatives')
  })

  /**
   * Two people opening the panel at once. The second import must not silently
   * double-write, and the message has to explain why nothing happened.
   */
  it('reports a collection that was populated by someone else mid-import', async () => {
    const user = userEvent.setup()
    count.mockResolvedValue(0)
    importSeed.mockRejectedValue(new Error('already-populated'))
    renderShell()

    await waitFor(() => expect(screen.getByRole('button', { name: /Importar/ })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Importar/ }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/ya tiene contenido/))
  })

  it('surfaces a read failure instead of showing an empty editor', async () => {
    count.mockRejectedValue(new Error('offline'))
    renderShell()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByText('EDITOR')).not.toBeInTheDocument()
  })

  /**
   * The gate was hardcoded Spanish long after the rest of the panel could be
   * switched, so choosing English left the one screen that explains what Import
   * does unreadable to whoever chose it. Asserting on the stored preference is
   * what stops a future editor from being added the same way.
   */
  it('renders the import gate in the chosen language, not always Spanish', async () => {
    window.localStorage.setItem('relif-lang', 'en')
    count.mockResolvedValue(0)
    renderShell()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Import 6 items' })).toBeInTheDocument(),
    )
    expect(screen.getByText(/The public site does not change/)).toBeInTheDocument()
    expect(screen.queryByText(/El sitio público no cambia/)).not.toBeInTheDocument()
  })

  it('falls back to Spanish when no language has been chosen', async () => {
    count.mockResolvedValue(0)
    renderShell()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Importar 6 elementos' })).toBeInTheDocument(),
    )
  })
})
