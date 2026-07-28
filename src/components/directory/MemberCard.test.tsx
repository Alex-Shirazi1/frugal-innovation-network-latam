import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemberCard } from './MemberCard'
import { I18nProvider } from '../../i18n/I18nContext'
import { ApiDataProvider } from '../../api/ApiDataContext'
import { institutionName } from '../../data/members'
import { makeMember } from '../../test/fixtures'
import { institutions } from '../../data/institutions'

// MemberCard reads institution names and interest labels from the data layer,
// so it needs both providers. No backend here — bundled data is the source.
function renderWithI18n(ui: ReactElement) {
  return render(
    <I18nProvider>
      <ApiDataProvider>{ui}</ApiDataProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
})


describe('MemberCard', () => {
  it('renders the member name and the localized title (default Spanish)', () => {
    renderWithI18n(<MemberCard member={makeMember()} />)
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText('Investigadora')).toBeInTheDocument()
  })

  it('shows deterministic avatar initials from the first two names', () => {
    renderWithI18n(<MemberCard member={makeMember({ fullName: 'Grace Brewster Hopper' })} />)
    // Only the first two words are used -> "GB".
    expect(screen.getByText('GB')).toBeInTheDocument()
  })

  it('labels an unaffiliated member as independent and hides the location line', () => {
    renderWithI18n(<MemberCard member={makeMember({ affiliationId: null })} />)
    expect(screen.getByText('Miembro independiente')).toBeInTheDocument()
    expect(screen.queryByText(/Jalisco, México/)).not.toBeInTheDocument()
  })

  it('shows the institution name and location for an affiliated member', () => {
    const affiliated = institutions[0]
    renderWithI18n(
      <MemberCard member={makeMember({ affiliationId: affiliated.id })} />,
    )
    expect(screen.getByText(institutionName(affiliated.id) as string)).toBeInTheDocument()
    expect(screen.getByText('Jalisco, México')).toBeInTheDocument()
  })

  it('renders at most three interest tags', () => {
    renderWithI18n(
      <MemberCard
        member={makeMember({ interestIds: ['salud', 'agua', 'energia', 'agro'] })}
      />,
    )
    const list = screen.getByRole('list', { name: 'Intereses de investigación' })
    expect(list.querySelectorAll('li')).toHaveLength(3)
  })

  it('renders a social link that opens in a new tab when a URL is present', () => {
    renderWithI18n(
      <MemberCard member={makeMember({ socialUrl: 'https://linkedin.com/in/ada' })} />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://linkedin.com/in/ada')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
    // The visible label strips the protocol and any path.
    expect(link).toHaveTextContent('linkedin.com')
  })

  it('omits the social link when no URL is provided', () => {
    renderWithI18n(<MemberCard member={makeMember({ socialUrl: undefined })} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
