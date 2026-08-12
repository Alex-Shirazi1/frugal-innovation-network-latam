/**
 * Covers the render paths of the members tab, and — just as importantly — proves
 * every dictionary key it reads actually exists. A missing key does not throw in
 * React; it renders the word "undefined" into the panel, which no other test here
 * would catch.
 *
 * Assertions stay in Spanish because that is the default language, and the panel
 * must not come up in English for the people who run the network.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MembersEditor } from './MembersEditor'
import { I18nProvider } from '../../i18n/I18nContext'
import { mapFormResponse } from '../../domain/memberImport'

const list = vi.fn()
const listArrived = vi.fn()
const publishArrived = vi.fn()
const discardArrived = vi.fn()
const remove = vi.fn()
const save = vi.fn()

vi.mock('../../api/adminApi', () => ({
  membersAdmin: {
    list: (...args: unknown[]) => list(...args),
    listArrived: (...args: unknown[]) => listArrived(...args),
    publishArrived: (...args: unknown[]) => publishArrived(...args),
    discardArrived: (...args: unknown[]) => discardArrived(...args),
    remove: (...args: unknown[]) => remove(...args),
    save: (...args: unknown[]) => save(...args),
  },
}))

const CLEAN_ANSWERS = {
  Nombre: 'Ada',
  Apellido: 'Lovelace',
  'Correo electrónico': 'ada@example.org',
  Cargo: 'researcher',
  Institución: 'ITESO',
  País: 'México',
  Región: 'Jalisco',
  Intereses: 'Salud frugal',
  'Áreas generales': 'Ingeniería',
  Idiomas: 'Español',
  Consentimiento: 'Sí',
}

const arrived = (answers: Record<string, string>, id = 'r1') => ({
  id,
  receivedAt: '2026-08-11T21:00:00.000Z',
  answers,
  outcome: mapFormResponse(answers),
})

const published = () => ({
  ...mapFormResponse(CLEAN_ANSWERS).member!,
  id: 'm1',
  publishedAt: '2026-08-01T10:00:00.000Z',
})

function renderTab() {
  return render(
    <I18nProvider>
      <MembersEditor />
    </I18nProvider>,
  )
}

beforeEach(() => {
  for (const fn of [list, listArrived, publishArrived, discardArrived, remove, save]) {
    fn.mockReset()
  }
  list.mockResolvedValue([])
  listArrived.mockResolvedValue([])
})

describe('MembersEditor', () => {
  it('reports both sections as empty when there is nothing yet', async () => {
    renderTab()
    expect(await screen.findByText('No hay respuestas pendientes.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay perfiles publicados.')).toBeInTheDocument()
  })

  it('says so when the Firestore backend is not reachable', async () => {
    listArrived.mockRejectedValue(new Error('firebase-not-configured'))
    renderTab()
    expect(
      await screen.findByText('Esta sección necesita el backend de Firestore configurado.'),
    ).toBeInTheDocument()
  })

  it('offers a one-click publish for a response that mapped cleanly', async () => {
    listArrived.mockResolvedValue([arrived(CLEAN_ANSWERS)])
    renderTab()

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Listo para publicar.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(publishArrived).toHaveBeenCalledWith('r1'))
  })

  /*
   * The rule that keeps a guess off the public directory: anything the mapping
   * could not settle must be reviewed in the form, never published in one click.
   */
  it('routes a response with unresolved answers to review instead of publish', async () => {
    listArrived.mockResolvedValue([
      arrived({ ...CLEAN_ANSWERS, Institución: 'Universidad Iberoamericana' }),
    ])
    renderTab()

    expect(await screen.findByRole('button', { name: 'Revisar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.getByText(/Universidad Iberoamericana/)).toBeInTheDocument()
  })

  it('explains why an invalid response cannot be published', async () => {
    listArrived.mockResolvedValue([arrived({ ...CLEAN_ANSWERS, Consentimiento: 'No' })])
    renderTab()
    expect(
      await screen.findByText('La respuesta no autoriza la publicación del perfil.'),
    ).toBeInTheDocument()
  })

  it('lists a published profile with the date it went live', async () => {
    list.mockResolvedValue([published()])
    renderTab()
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText(/Publicado el/)).toBeInTheDocument()
  })

  it('asks before removing somebody from the public directory', async () => {
    list.mockResolvedValue([published()])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(confirm).toHaveBeenCalled()
    // Declining the confirmation must not delete anyone.
    expect(remove).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('m1'))
    confirm.mockRestore()
  })

  it('opens a blank form for a manual addition', async () => {
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: '+ Añadir a mano' }))

    expect(screen.getByText('Añadir perfil')).toBeInTheDocument()
    // Derived fields are computed, never typed, so the form must not offer them.
    expect(screen.queryByLabelText(/Nombre completo/)).not.toBeInTheDocument()
  })

  it('names the compiled-in sample profiles so the count gap is not a mystery', async () => {
    renderTab()
    expect(await screen.findByText(/54 perfiles de ejemplo/)).toBeInTheDocument()
  })
})
