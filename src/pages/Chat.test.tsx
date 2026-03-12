import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Chat from './Chat'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  fetchChatChannels: vi.fn(),
  leaveChatChannel: vi.fn(),
  deleteChatChannel: vi.fn(),
}))

vi.mock('../components/chat/ChannelList', () => ({
  default: (props: {
    channels: { id: number; name: string }[];
    activeChannelId: number | null;
    onSelectChannel: (id: number) => void;
    onCreateChannel: () => void;
    onLeaveChannel: (id: number) => void;
    onInvite: (id: number) => void;
    onDeleteChannel: (id: number) => void;
    onManageMembers: (id: number) => void;
  }) => (
    <div data-testid="channel-list">
      {props.channels.map(c => <span key={c.id}>{c.name}</span>)}
      <button onClick={props.onCreateChannel}>+ New</button>
      <button onClick={() => props.onSelectChannel(1)}>Select 1</button>
      <button onClick={() => props.onLeaveChannel(1)}>Leave 1</button>
      <button onClick={() => props.onLeaveChannel(2)}>Leave 2</button>
      <button onClick={() => props.onDeleteChannel(1)}>Delete 1</button>
      <button onClick={() => props.onDeleteChannel(2)}>Delete 2</button>
      <button onClick={() => props.onInvite(1)}>Invite 1</button>
      <button onClick={() => props.onManageMembers(1)}>Members 1</button>
    </div>
  ),
}))

vi.mock('../components/chat/MessageArea', () => ({
  default: ({ channel }: { channel: { name: string } }) => (
    <div data-testid="message-area">{channel.name}</div>
  ),
}))

vi.mock('../components/chat/CreateChannelModal', () => ({
  default: ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => (
    <div data-testid="create-modal">
      <button onClick={onClose}>Close</button>
      <button onClick={onCreated}>Created</button>
    </div>
  ),
}))

vi.mock('../components/chat/InviteModal', () => ({
  default: ({ channelId, onClose, onInvited }: { channelId: number; channelName: string; encrypted: boolean; currentKeyVersion: number; onClose: () => void; onInvited: () => void }) => (
    <div data-testid="invite-modal">
      <span>Invite to {channelId}</span>
      <button onClick={onClose}>Close Invite</button>
      <button onClick={onInvited}>Invited</button>
    </div>
  ),
}))

vi.mock('../components/chat/MembersModal', () => ({
  default: ({ channelId, onClose, onKicked }: { channelId: number; channelName: string; encrypted: boolean; onClose: () => void; onKicked: () => void }) => (
    <div data-testid="members-modal">
      <span>Members of {channelId}</span>
      <button onClick={onClose}>Close Members</button>
      <button onClick={onKicked}>Kicked</button>
    </div>
  ),
}))

const api = await import('../services/api')

const mockChannels = [
  { id: 1, name: 'general', createdAt: '2026-01-01T00:00:00Z', memberCount: 3, joined: true, isOwner: true, isSystem: false, unreadCount: 0, encrypted: false, currentKeyVersion: 0 },
  { id: 2, name: 'random', createdAt: '2026-01-01T00:00:00Z', memberCount: 2, joined: true, isOwner: false, isSystem: false, unreadCount: 1, encrypted: false, currentKeyVersion: 0 },
]

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(api.fetchChatChannels).mockReset()
  vi.mocked(api.leaveChatChannel).mockReset()
  vi.mocked(api.deleteChatChannel).mockReset()
  mockNavigate.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderChat(path = '/chat') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:channelId" element={<Chat />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Chat', () => {
  it('shows loading state', () => {
    vi.mocked(api.fetchChatChannels).mockReturnValue(new Promise(() => {}))
    renderChat()
    expect(screen.getByText('Loading chat...')).toBeInTheDocument()
  })

  it('renders channel list after loading', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('general')).toBeInTheDocument()
      expect(screen.getByText('random')).toBeInTheDocument()
    })
  })

  it('shows placeholder when no channel is active', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('Select a channel to start chatting')).toBeInTheDocument()
    })
  })

  it('shows message area when channel is selected via URL', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat('/chat/1')
    await waitFor(() => {
      expect(screen.getByTestId('message-area')).toHaveTextContent('general')
    })
  })

  it('navigates when selecting a channel', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByText('Select 1'))
    expect(mockNavigate).toHaveBeenCalledWith('/chat/1')
  })

  it('opens and closes create channel modal', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Open modal
    await user.click(screen.getByText('+ New'))
    expect(screen.getByTestId('create-modal')).toBeInTheDocument()

    // Close modal
    await user.click(screen.getByText('Close'))
    expect(screen.queryByTestId('create-modal')).not.toBeInTheDocument()
  })

  it('closes modal and reloads channels on channel created', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByText('+ New'))
    expect(screen.getByTestId('create-modal')).toBeInTheDocument()

    vi.mocked(api.fetchChatChannels).mockResolvedValue([...mockChannels, { id: 3, name: 'new-channel', createdAt: '2026-01-02T00:00:00Z', memberCount: 1, joined: true, isOwner: true, isSystem: false, unreadCount: 0, encrypted: false, currentKeyVersion: 0 }])

    await user.click(screen.getByText('Created'))

    await waitFor(() => {
      expect(screen.queryByTestId('create-modal')).not.toBeInTheDocument()
      expect(screen.getByText('new-channel')).toBeInTheDocument()
    })
  })

  it('leaves a channel and navigates to /chat if it was active', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    vi.mocked(api.leaveChatChannel).mockResolvedValue(undefined)
    renderChat('/chat/1')
    await waitFor(() => expect(screen.getByTestId('message-area')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Leave 1'))

    await waitFor(() => {
      expect(api.leaveChatChannel).toHaveBeenCalledWith(1)
      expect(mockNavigate).toHaveBeenCalledWith('/chat')
    })
  })

  it('leaves a non-active channel without navigating', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    vi.mocked(api.leaveChatChannel).mockResolvedValue(undefined)
    renderChat('/chat/1')
    await waitFor(() => expect(screen.getByTestId('message-area')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Leave 2'))

    await waitFor(() => {
      expect(api.leaveChatChannel).toHaveBeenCalledWith(2)
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/chat')
  })

  it('shows error when leave channel fails', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    vi.mocked(api.leaveChatChannel).mockRejectedValue(new Error('fail'))
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Leave 1'))

    await waitFor(() => {
      expect(screen.getByText('Failed to leave channel')).toBeInTheDocument()
    })
  })

  it('deletes a channel and navigates to /chat if it was active', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    vi.mocked(api.deleteChatChannel).mockResolvedValue(undefined)
    renderChat('/chat/1')
    await waitFor(() => expect(screen.getByTestId('message-area')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Delete 1'))

    await waitFor(() => {
      expect(api.deleteChatChannel).toHaveBeenCalledWith(1)
      expect(mockNavigate).toHaveBeenCalledWith('/chat')
    })
  })

  it('deletes a non-active channel without navigating', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    vi.mocked(api.deleteChatChannel).mockResolvedValue(undefined)
    renderChat('/chat/1')
    await waitFor(() => expect(screen.getByTestId('message-area')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Delete 2'))

    await waitFor(() => {
      expect(api.deleteChatChannel).toHaveBeenCalledWith(2)
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/chat')
  })

  it('shows error when delete channel fails', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    vi.mocked(api.deleteChatChannel).mockRejectedValue(new Error('fail'))
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByText('Delete 1'))

    await waitFor(() => {
      expect(screen.getByText('Failed to delete channel')).toBeInTheDocument()
    })
  })

  it('opens and closes invite modal', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByText('Invite 1'))
    expect(screen.getByTestId('invite-modal')).toBeInTheDocument()
    expect(screen.getByText('Invite to 1')).toBeInTheDocument()

    await user.click(screen.getByText('Close Invite'))
    expect(screen.queryByTestId('invite-modal')).not.toBeInTheDocument()
  })

  it('reloads channels when invite onInvited fires', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByText('Invite 1'))
    expect(screen.getByTestId('invite-modal')).toBeInTheDocument()

    const callCountBefore = vi.mocked(api.fetchChatChannels).mock.calls.length
    await user.click(screen.getByText('Invited'))

    await waitFor(() => {
      expect(vi.mocked(api.fetchChatChannels).mock.calls.length).toBeGreaterThan(callCountBefore)
    })
  })

  it('opens and closes members modal', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByText('Members 1'))
    expect(screen.getByTestId('members-modal')).toBeInTheDocument()
    expect(screen.getByText('Members of 1')).toBeInTheDocument()

    await user.click(screen.getByText('Close Members'))
    expect(screen.queryByTestId('members-modal')).not.toBeInTheDocument()
  })

  it('reloads channels when members onKicked fires', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByText('Members 1'))
    expect(screen.getByTestId('members-modal')).toBeInTheDocument()

    const callCountBefore = vi.mocked(api.fetchChatChannels).mock.calls.length
    await user.click(screen.getByText('Kicked'))

    await waitFor(() => {
      expect(vi.mocked(api.fetchChatChannels).mock.calls.length).toBeGreaterThan(callCountBefore)
    })
  })

  it('polls for channels on interval', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const callCountAfterLoad = vi.mocked(api.fetchChatChannels).mock.calls.length

    // Advance timer by 10s to trigger interval poll
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    await waitFor(() => {
      expect(vi.mocked(api.fetchChatChannels).mock.calls.length).toBeGreaterThan(callCountAfterLoad)
    })
  })

  it('clears error on subsequent leave attempt', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    vi.mocked(api.leaveChatChannel).mockRejectedValueOnce(new Error('fail'))
    renderChat()
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument())

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // First attempt fails
    await user.click(screen.getByText('Leave 1'))
    await waitFor(() => {
      expect(screen.getByText('Failed to leave channel')).toBeInTheDocument()
    })

    // Second attempt succeeds — error should be cleared
    vi.mocked(api.leaveChatChannel).mockResolvedValue(undefined)
    await user.click(screen.getByText('Leave 2'))
    await waitFor(() => {
      expect(screen.queryByText('Failed to leave channel')).not.toBeInTheDocument()
    })
  })
})
