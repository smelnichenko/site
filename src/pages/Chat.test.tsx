import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Chat from './Chat'

vi.mock('../services/api', () => ({
  fetchChatChannels: vi.fn(),
  leaveChatChannel: vi.fn(),
  deleteChatChannel: vi.fn(),
}))

vi.mock('../components/chat/ChannelList', () => ({
  default: ({ channels, onCreateChannel }: { channels: { id: number; name: string }[]; onCreateChannel: () => void }) => (
    <div data-testid="channel-list">
      {channels.map(c => <span key={c.id}>{c.name}</span>)}
      <button onClick={onCreateChannel}>+ New</button>
    </div>
  ),
}))

vi.mock('../components/chat/MessageArea', () => ({
  default: ({ channel }: { channel: { name: string } }) => (
    <div data-testid="message-area">{channel.name}</div>
  ),
}))

vi.mock('../components/chat/CreateChannelModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="create-modal"><button onClick={onClose}>Close</button></div>
  ),
}))

vi.mock('../components/chat/InviteModal', () => ({
  default: () => <div data-testid="invite-modal" />,
}))

vi.mock('../components/chat/MembersModal', () => ({
  default: () => <div data-testid="members-modal" />,
}))

const api = await import('../services/api')

const mockChannels = [
  { id: 1, name: 'general', createdAt: '2026-01-01T00:00:00Z', memberCount: 3, joined: true, isOwner: true, unreadCount: 0, encrypted: false, currentKeyVersion: 0 },
  { id: 2, name: 'random', createdAt: '2026-01-01T00:00:00Z', memberCount: 2, joined: true, isOwner: false, unreadCount: 1, encrypted: false, currentKeyVersion: 0 },
]

beforeEach(() => {
  vi.mocked(api.fetchChatChannels).mockReset()
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

  it('renders channel list', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('general')).toBeInTheDocument()
      expect(screen.getByText('random')).toBeInTheDocument()
    })
  })

  it('shows select channel message when no channel active', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat()
    await waitFor(() => {
      expect(screen.getByText('Select a channel to start chatting')).toBeInTheDocument()
    })
  })

  it('shows message area when channel selected', async () => {
    vi.mocked(api.fetchChatChannels).mockResolvedValue(mockChannels)
    renderChat('/chat/1')
    await waitFor(() => {
      expect(screen.getByTestId('message-area')).toBeInTheDocument()
      expect(screen.getByTestId('message-area')).toHaveTextContent('general')
    })
  })
})
