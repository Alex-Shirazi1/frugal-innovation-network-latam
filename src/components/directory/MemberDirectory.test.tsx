import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemberDirectory } from './MemberDirectory'
import { I18nProvider } from '../../i18n/I18nContext'
import { ApiDataProvider } from '../../api/ApiDataContext'
import { seedMembers } from '../../data/members'

// The directory reads members, institutions and option lists from the data
// layer. No backend here — the bundled data is the source, same as MemberCard.
function renderDirectory() {
  return render(
    <I18nProvider>
      <ApiDataProvider>
        <MemberDirectory />
      </ApiDataProvider>
    </I18nProvider>,
  )
}

function carousel(): HTMLElement | null {
  return screen.queryByRole('group', { name: 'Carrusel de miembros de la red' })
}

/** Cards on the visible half of the track, excluding the inert duplicate. */
function visibleCards(): HTMLElement[] {
  const strip = carousel()
  if (!strip) return []
  const list = strip.querySelector('ul:not([inert])')
  return list ? [...list.querySelectorAll<HTMLElement>(':scope > li')] : []
}

/**
 * Makes the carousel believe its cards are wider than the column.
 *
 * jsdom has no layout engine, so every element reports a width of 0 and the
 * component's overflow test can only ever come out false. Faking `scrollWidth`
 * is the one way to reach the animated branch from here; whether the cards
 * genuinely overflow at a given viewport is a question for a real browser.
 * Returns a restore function — the stub is on a shared prototype.
 */
function stubOverflowingCards(): () => void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => 5000,
  })
  return () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', original)
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
})

describe('MemberDirectory', () => {
  it('presents the members as a carousel rather than a grid', () => {
    const { container } = renderDirectory()
    // Allan's ask: a directory of any size (eventually 200) should never be a wall.
    expect(carousel()).toBeInTheDocument()
    expect(container.querySelector('ul.grid')).not.toBeInTheDocument()
  })

  it('points the visitor at the search as the way to find someone', () => {
    renderDirectory()
    expect(
      screen.getByText('Busca por nombre, área o país para encontrar a alguien en particular.'),
    ).toBeInTheDocument()
  })

  /**
   * The point of the rework: searching narrows what is on the strip. It does
   * not expand into a grid, which is what the first version did.
   */
  it('keeps the carousel when a search narrows the list', async () => {
    const user = userEvent.setup()
    const { container } = renderDirectory()
    expect(visibleCards()).toHaveLength(seedMembers.length)

    await user.type(screen.getByRole('searchbox'), 'Francisco')

    expect(carousel()).toBeInTheDocument()
    expect(container.querySelector('ul.grid')).not.toBeInTheDocument()
    expect(visibleCards().length).toBeLessThan(seedMembers.length)
    expect(
      within(carousel() as HTMLElement).getAllByRole('button', {
        name: 'Francisco Javier Álvarez Torres',
      }).length,
    ).toBeGreaterThan(0)
  })

  it('keeps the carousel when a filter alone is applied', async () => {
    const user = userEvent.setup()
    const { container } = renderDirectory()

    await user.click(screen.getByRole('button', { name: 'Independiente' }))

    expect(carousel()).toBeInTheDocument()
    expect(container.querySelector('ul.grid')).not.toBeInTheDocument()
    expect(visibleCards().length).toBeGreaterThan(0)
  })

  it('restores the full list when the filters are cleared', async () => {
    const user = userEvent.setup()
    renderDirectory()

    await user.type(screen.getByRole('searchbox'), 'Francisco')
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(visibleCards()).toHaveLength(seedMembers.length)
  })

  it('drops the carousel for a message when nothing matches', async () => {
    const user = userEvent.setup()
    renderDirectory()

    await user.type(screen.getByRole('searchbox'), 'zzzznotamember')

    expect(carousel()).not.toBeInTheDocument()
    expect(screen.getByText('No se encontraron miembros con ese criterio.')).toBeInTheDocument()
  })

  /**
   * jsdom reports every width as 0, which is exactly the "cards fit" case: no
   * loop to hide, so no duplicate track and nothing to animate.
   */
  it('renders a single, unduplicated track when the cards fit', () => {
    renderDirectory()
    const strip = carousel() as HTMLElement
    expect(strip.querySelectorAll(':scope > div > ul')).toHaveLength(1)
    expect(strip.querySelector(':scope > div')).not.toHaveClass('conveyor-track')
  })

  it('duplicates the track and marks the copy inert once the cards overflow', () => {
    const restore = stubOverflowingCards()
    try {
      renderDirectory()
      const strip = carousel() as HTMLElement
      const lists = [...strip.querySelectorAll(':scope > div > ul')]
      // Two identical halves: the loop seam is invisible only because the list
      // is rendered twice, but the copy must not double the tab order.
      expect(lists).toHaveLength(2)
      expect(lists.filter((list) => list.hasAttribute('inert'))).toHaveLength(1)
      expect(strip.querySelector(':scope > div')).toHaveClass('conveyor-track')
    } finally {
      restore()
    }
  })

  it('keeps the carousel cards clickable, opening the member profile', async () => {
    const user = userEvent.setup()
    renderDirectory()

    const cards = within(carousel() as HTMLElement).getAllByRole('button', {
      name: 'Francisco Javier Álvarez Torres',
    })
    await user.click(cards[0])

    expect(screen.getByRole('dialog')).toHaveTextContent('Francisco Javier Álvarez Torres')
  })

  it('reports the count of whatever is currently on the strip', async () => {
    const user = userEvent.setup()
    renderDirectory()
    expect(screen.getByRole('status')).toHaveTextContent(`Mostrando ${seedMembers.length} personas`)

    await user.type(screen.getByRole('searchbox'), 'Francisco')

    expect(screen.getByRole('status')).not.toHaveTextContent(`Mostrando ${seedMembers.length} personas`)
  })
})
