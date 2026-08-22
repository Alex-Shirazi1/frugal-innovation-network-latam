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
import { seedMembers } from '../../data/members'

const list = vi.fn()
const remove = vi.fn()
const save = vi.fn()

vi.mock('../../api/adminApi', () => ({
  membersAdmin: {
    list: (...args: unknown[]) => list(...args),
    remove: (...args: unknown[]) => remove(...args),
    save: (...args: unknown[]) => save(...args),
  },
}))

const CLEAN_ANSWERS = {
  'Nombre completo': 'Ada Lovelace',
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
  for (const fn of [list, remove, save]) {
    fn.mockReset()
  }
  list.mockResolvedValue([])
})

describe('MembersEditor', () => {
  it('reports the section as empty when there is nothing yet', async () => {
    renderTab()
    expect(await screen.findByText('Todavía no hay perfiles publicados.')).toBeInTheDocument()
  })

  it('says so when the Firestore backend is not reachable', async () => {
    list.mockRejectedValue(new Error('firebase-not-configured'))
    renderTab()
    expect(
      await screen.findByText('Esta sección necesita el backend de Firestore configurado.'),
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
    // The name IS typed — it is stored as the member wrote it. What the form
    // must never offer is a derived field: the localized title comes from the
    // position whitelist and the avatar hue from the name.
    expect(screen.getByLabelText(/Nombre completo/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Título/)).not.toBeInTheDocument()
  })

  it('filters the published list by name', async () => {
    list.mockResolvedValue([
      published(),
      { ...published(), id: 'm2', fullName: 'Beatriz Delfa Rodríguez' },
    ])
    renderTab()

    await userEvent.type(await screen.findByLabelText('Buscar perfiles'), 'beatriz')

    expect(screen.getByText('Beatriz Delfa Rodríguez')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  /*
   * A directory of Latin American names is typed without diacritics constantly.
   * "Nunez" missing "Núñez" would read as an absent profile, not a fussy search.
   */
  it('matches names typed without their accents', async () => {
    list.mockResolvedValue([{ ...published(), id: 'm3', fullName: 'Ana Núñez Ferreira' }])
    renderTab()

    await userEvent.type(await screen.findByLabelText('Buscar perfiles'), 'nunez')
    expect(screen.getByText('Ana Núñez Ferreira')).toBeInTheDocument()
  })

  it('says so when a search matches nothing', async () => {
    list.mockResolvedValue([published()])
    renderTab()

    await userEvent.type(await screen.findByLabelText('Buscar perfiles'), 'zzzz')
    expect(screen.getByText(/Ningún perfil coincide/)).toBeInTheDocument()
  })

  it('names the compiled-in profiles so the count gap is not a mystery', async () => {
    renderTab()
    expect(
      await screen.findByText(new RegExp(`${seedMembers.length} perfiles incluidos en el código`)),
    ).toBeInTheDocument()
  })
})
