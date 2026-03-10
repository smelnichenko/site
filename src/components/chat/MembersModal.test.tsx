import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MembersModal from './MembersModal'

vi.mock('../../services/api', () => ({
  fetchChannelMembers: vi.fn(),
  kickFromChannel: vi.fn(),
  fetchPublicKeys: vi.fn(),
  rotateChannelKeys: vi.fn(),
}))

vi.mock('../../services/crypto', () => ({
  generateChannelKey: vi.fn(),
  wrapChannelKeyForMember: vi.fn(),
  importPublicKey: vi.fn(),
}))

vi.mock('../../services/keyStore', () => ({
  setChannelKey: vi.fn(),
}))

const api = await import('../../services/api')

beforeEach(() => {
  vi.mocked(api.fetchChannelMembers).mockReset()
  vi.mocked(api.kickFromChannel).mockReset()
  localStorage.setItem('email', 'owner@test.com')
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

describe('MembersModal', () => {
  it('renders modal with channel name', () => {
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([])
    render(<MembersModal channelId={1} channelName="general" onClose={vi.fn()} onKicked={vi.fn()} />)
    expect(screen.getByText('Members of #general')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(api.fetchChannelMembers).mockReturnValue(new Promise(() => {}))
    render(<MembersModal channelId={1} channelName="general" onClose={vi.fn()} onKicked={vi.fn()} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows members list', async () => {
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([
      { id: 1, email: 'owner@test.com', joinedAt: '2026-01-01T00:00:00Z' },
      { id: 2, email: 'user@test.com', joinedAt: '2026-01-01T00:00:00Z' },
    ])

    render(<MembersModal channelId={1} channelName="general" onClose={vi.fn()} onKicked={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('owner@test.com')).toBeInTheDocument()
      expect(screen.getByText('user@test.com')).toBeInTheDocument()
    })
  })

  it('shows Kick button for other members, not self', async () => {
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([
      { id: 1, email: 'owner@test.com', joinedAt: '2026-01-01T00:00:00Z' },
      { id: 2, email: 'user@test.com', joinedAt: '2026-01-01T00:00:00Z' },
    ])

    render(<MembersModal channelId={1} channelName="general" onClose={vi.fn()} onKicked={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('Kick').length).toBe(1) // Only for user, not owner
    })
  })

  it('kicks member on button click', async () => {
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([
      { id: 1, email: 'owner@test.com', joinedAt: '2026-01-01T00:00:00Z' },
      { id: 2, email: 'user@test.com', joinedAt: '2026-01-01T00:00:00Z' },
    ])
    vi.mocked(api.kickFromChannel).mockResolvedValue(undefined)

    const onKicked = vi.fn()
    const user = userEvent.setup()
    render(<MembersModal channelId={1} channelName="general" onClose={vi.fn()} onKicked={onKicked} />)
    await waitFor(() => screen.getByText('Kick'))

    await user.click(screen.getByText('Kick'))
    expect(api.kickFromChannel).toHaveBeenCalledWith(1, 2)
  })

  it('shows empty state', async () => {
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([])
    render(<MembersModal channelId={1} channelName="general" onClose={vi.fn()} onKicked={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('No members')).toBeInTheDocument()
    })
  })

  it('calls onClose when Close clicked', async () => {
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([])
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<MembersModal channelId={1} channelName="general" onClose={onClose} onKicked={vi.fn()} />)
    await user.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
