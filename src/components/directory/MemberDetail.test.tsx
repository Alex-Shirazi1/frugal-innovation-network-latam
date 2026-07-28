import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemberDetail } from './MemberDetail'
import { I18nProvider } from '../../i18n/I18nContext'
import { ApiDataProvider } from '../../api/ApiDataContext'
import { makeMember } from '../../test/fixtures'
import { institutions } from '../../data/institutions'

function renderDetail(member = makeMember(), onClose = vi.fn()) {
  render(
    <I18nProvider>
      <ApiDataProvider>
        <MemberDetail member={member} onClose={onClose} />
      </ApiDataProvider>
    </I18nProvider>,
  )
  return { onClose }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
})

describe('MemberDetail', () => {
  it('is an accessible dialog labelled by the member name', () => {
    renderDetail()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument()
  })

  /** Allan listed each of these fields explicitly; the profile must show them. */
  it('shows every field from the intake form', () => {
    renderDetail(
      makeMember({
        jobPositionName: 'Profesora Titular, Departamento de Diseño',
        biography: 'Trabaja en soluciones de bajo costo con comunidades rurales.',
        interestIds: ['salud', 'agua'],
        generalAreaIds: ['ingenieria'],
        languages: ['es', 'en'],
        socialUrl: 'https://linkedin.com/in/ada',
      }),
    )
    expect(screen.getByText('Profesora Titular, Departamento de Diseño')).toBeInTheDocument()
    expect(screen.getByText(/soluciones de bajo costo/)).toBeInTheDocument()
    expect(screen.getByText('Salud frugal')).toBeInTheDocument()
    expect(screen.getByText('Agua y saneamiento')).toBeInTheDocument()
    expect(screen.getByText('Ingeniería')).toBeInTheDocument()
    expect(screen.getByText('Español · Inglés')).toBeInTheDocument()
    expect(screen.getByText('Jalisco, México')).toBeInTheDocument()
  })

  it('labels an unaffiliated member as independent', () => {
    renderDetail(makeMember({ affiliationId: null }))
    expect(screen.getByText('Miembro independiente')).toBeInTheDocument()
  })

  it('resolves an institution name for an affiliated member', () => {
    renderDetail(makeMember({ affiliationId: institutions[0].id }))
    expect(screen.getByText(institutions[0].name)).toBeInTheDocument()
  })

  it('falls back to placeholder copy when there is no biography', () => {
    renderDetail(makeMember({ biography: '' }))
    expect(screen.getByText('Este miembro aún no ha agregado una biografía.')).toBeInTheDocument()
  })

  it('omits the social row entirely when no URL is present', () => {
    renderDetail(makeMember({ socialUrl: undefined }))
    expect(screen.queryByText('Enlace profesional')).not.toBeInTheDocument()
  })

  it('opens social links safely in a new tab', () => {
    renderDetail(makeMember({ socialUrl: 'https://linkedin.com/in/ada' }))
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  /** Header X and footer button are both offered on purpose (touch users who
   *  have scrolled), so both share the "Cerrar" name — assert on both. */
  it('closes from either close control and from Escape', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDetail()

    const closers = screen.getAllByRole('button', { name: 'Cerrar' })
    expect(closers).toHaveLength(2)

    for (const closer of closers) {
      onClose.mockClear()
      await user.click(closer)
      expect(onClose).toHaveBeenCalledTimes(1)
    }

    onClose.mockClear()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
