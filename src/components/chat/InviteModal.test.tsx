import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InviteModal from './InviteModal'

vi.mock('../../services/api', () => ({
  fetchChatUsers: vi.fn(),
  fetchChannelMembers: vi.fn(),
  inviteToChannel: vi.fn(),
  fetchPublicKeys: vi.fn(),
  setChannelKeys: vi.fn(),
}))

vi.mock('../../services/crypto', () => ({
  wrapChannelKeyForMember: vi.fn(),
  importPublicKey: vi.fn(),
}))

vi.mock('../../services/keyStore', () => ({
  getChannelKey: vi.fn(),
}))

const api = await import('../../services/api')

beforeEach(() => {
  vi.mocked(api.fetchChatUsers).mockReset()
  vi.mocked(api.fetchChannelMembers).mockReset()
  vi.mocked(api.inviteToChannel).mockReset()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

describe('InviteModal', () => {
  it('renders modal with channel name', async () => {
    vi.mocked(api.fetchChatUsers).mockResolvedValue([])
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([])
    render(<InviteModal channelId={1} channelName="general" onClose={vi.fn()} onInvited={vi.fn()} />)
    await waitFor(() => expect(api.fetchChatUsers).toHaveBeenCalled())
    expect(screen.getByText('Invite to #general')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(api.fetchChatUsers).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.fetchChannelMembers).mockReturnValue(new Promise(() => {}))
    render(<InviteModal channelId={1} channelName="general" onClose={vi.fn()} onInvited={vi.fn()} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows users with invite buttons', async () => {
    vi.mocked(api.fetchChatUsers).mockResolvedValue([
      { id: 1, uuid: 'uuid-1', email: 'user1@test.com' },
      { id: 2, uuid: 'uuid-2', email: 'user2@test.com' },
    ])
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([
      { id: 1, uuid: 'uuid-1', email: 'user1@test.com', joinedAt: '2026-01-01T00:00:00Z' },
    ])

    render(<InviteModal channelId={1} channelName="general" onClose={vi.fn()} onInvited={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument()
      expect(screen.getByText('user2@test.com')).toBeInTheDocument()
      expect(screen.getByText('Joined')).toBeInTheDocument()
      expect(screen.getByText('Invite')).toBeInTheDocument()
    })
  })

  it('invites user on button click', async () => {
    vi.mocked(api.fetchChatUsers).mockResolvedValue([{ id: 2, uuid: 'uuid-2', email: 'user2@test.com' }])
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([])
    vi.mocked(api.inviteToChannel).mockResolvedValue(undefined)

    const onInvited = vi.fn()
    const user = userEvent.setup()
    render(<InviteModal channelId={1} channelName="general" onClose={vi.fn()} onInvited={onInvited} />)
    await waitFor(() => screen.getByText('Invite'))

    await user.click(screen.getByText('Invite'))
    expect(api.inviteToChannel).toHaveBeenCalledWith(1, 'uuid-2')
  })

  it('filters users by search', async () => {
    vi.mocked(api.fetchChatUsers).mockResolvedValue([
      { id: 1, uuid: 'uuid-1', email: 'alice@test.com' },
      { id: 2, uuid: 'uuid-2', email: 'bob@test.com' },
    ])
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([])

    const user = userEvent.setup()
    render(<InviteModal channelId={1} channelName="general" onClose={vi.fn()} onInvited={vi.fn()} />)
    await waitFor(() => screen.getByText('alice@test.com'))

    await user.type(screen.getByPlaceholderText('Search users...'), 'bob')
    expect(screen.queryByText('alice@test.com')).not.toBeInTheDocument()
    expect(screen.getByText('bob@test.com')).toBeInTheDocument()
  })

  it('calls onClose when Close clicked', async () => {
    vi.mocked(api.fetchChatUsers).mockResolvedValue([])
    vi.mocked(api.fetchChannelMembers).mockResolvedValue([])
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<InviteModal channelId={1} channelName="general" onClose={onClose} onInvited={vi.fn()} />)
    await waitFor(() => expect(api.fetchChatUsers).toHaveBeenCalled())
    await user.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
