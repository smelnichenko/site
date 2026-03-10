import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessageArea from './MessageArea'

vi.mock('../../services/api', () => ({
  fetchChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  editChatMessage: vi.fn(),
  markChannelRead: vi.fn(),
  verifyChannelChain: vi.fn(),
  fetchChannelKeys: vi.fn(),
}))

vi.mock('../../services/crypto', () => ({
  encryptMessage: vi.fn(),
  decryptMessage: vi.fn(),
  unwrapChannelKey: vi.fn(),
}))

vi.mock('../../services/keyStore', () => ({
  getLatestChannelKey: vi.fn(),
  getChannelKey: vi.fn(),
  setChannelKey: vi.fn(),
  getIdentityPrivateKey: vi.fn(),
}))

const api = await import('../../services/api')
const crypto = await import('../../services/crypto')
const keyStoreModule = await import('../../services/keyStore')

const baseChannel = {
  id: 1,
  uuid: 'ch-uuid',
  name: 'general',
  type: 'PUBLIC' as const,
  memberCount: 3,
  unreadCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  encrypted: false,
  currentKeyVersion: 0,
  joined: true,
  isOwner: false,
}

const makeMsg = (id: string, username: string, content: string, createdAt = '2026-01-15T10:30:00Z') => ({
  messageId: id,
  channelId: 1,
  userId: 1,
  username,
  content,
  createdAt,
  hash: undefined as string | undefined,
  prevHash: undefined as string | undefined,
  edited: false,
  deleted: false,
  editedContent: undefined as string | undefined,
  keyVersion: undefined as number | undefined,
})

// jsdom doesn't support scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

beforeEach(() => {
  vi.mocked(api.fetchChatMessages).mockReset()
  vi.mocked(api.sendChatMessage).mockReset()
  vi.mocked(api.editChatMessage).mockReset()
  vi.mocked(api.markChannelRead).mockResolvedValue(undefined)
  vi.mocked(api.verifyChannelChain).mockReset()
  vi.mocked(api.fetchChannelKeys).mockReset()
  vi.mocked(crypto.encryptMessage).mockReset()
  vi.mocked(crypto.decryptMessage).mockReset()
  vi.mocked(crypto.unwrapChannelKey).mockReset()
  vi.mocked(keyStoreModule.getLatestChannelKey).mockReturnValue(null)
  vi.mocked(keyStoreModule.getChannelKey).mockReturnValue(null)
  vi.mocked(keyStoreModule.getIdentityPrivateKey).mockReturnValue(null)
  localStorage.setItem('email', 'me@test.com')
})

describe('MessageArea', () => {
  it('renders channel header with name and member count', () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    render(<MessageArea channel={baseChannel} />)
    expect(screen.getByText('# general')).toBeInTheDocument()
    expect(screen.getByText('3 members')).toBeInTheDocument()
  })

  it('shows empty state when no messages', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument()
    })
  })

  it('renders messages', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([
      makeMsg('1', 'alice@test.com', 'Hello world'),
      makeMsg('2', 'bob@test.com', 'Hi there'),
    ])
    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument()
      expect(screen.getByText('Hi there')).toBeInTheDocument()
      expect(screen.getByText('alice@test.com')).toBeInTheDocument()
      expect(screen.getByText('bob@test.com')).toBeInTheDocument()
    })
  })

  it('shows input placeholder with channel name', () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    render(<MessageArea channel={baseChannel} />)
    expect(screen.getByPlaceholderText('Message #general')).toBeInTheDocument()
  })

  it('sends a message on button click', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    const sentMsg = makeMsg('new', 'me@test.com', 'My message')
    vi.mocked(api.sendChatMessage).mockResolvedValue(sentMsg)

    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)

    const textarea = screen.getByPlaceholderText('Message #general')
    await user.type(textarea, 'My message')
    await user.click(screen.getByText('Send'))

    expect(api.sendChatMessage).toHaveBeenCalledWith(1, 'My message', undefined, undefined)
  })

  it('sends message on Enter key', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    vi.mocked(api.sendChatMessage).mockResolvedValue(makeMsg('new', 'me@test.com', 'Enter msg'))

    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)

    const textarea = screen.getByPlaceholderText('Message #general')
    await user.type(textarea, 'Enter msg{Enter}')

    expect(api.sendChatMessage).toHaveBeenCalledWith(1, 'Enter msg', undefined, undefined)
  })

  it('disables Send button when input is empty', () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    render(<MessageArea channel={baseChannel} />)
    expect(screen.getByText('Send')).toBeDisabled()
  })

  it('shows edit button only for own messages', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([
      makeMsg('1', 'me@test.com', 'My message'),
      makeMsg('2', 'other@test.com', 'Their message'),
    ])
    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => {
      expect(screen.getAllByText('edit').length).toBe(1)
    })
  })

  it('enters edit mode on edit button click', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([
      makeMsg('1', 'me@test.com', 'Original text'),
    ])
    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => screen.getByText('edit'))

    await user.click(screen.getByText('edit'))
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('saves an edited message', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([
      makeMsg('1', 'me@test.com', 'Original'),
    ])
    vi.mocked(api.editChatMessage).mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => screen.getByText('edit'))
    await user.click(screen.getByText('edit'))

    const editTextarea = screen.getByDisplayValue('Original')
    await user.clear(editTextarea)
    await user.type(editTextarea, 'Edited text')
    await user.click(screen.getByText('Save'))

    expect(api.editChatMessage).toHaveBeenCalledWith(1, '1', 'Edited text')
  })

  it('cancels edit mode', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([
      makeMsg('1', 'me@test.com', 'Original'),
    ])
    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => screen.getByText('edit'))
    await user.click(screen.getByText('edit'))
    await user.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Save')).not.toBeInTheDocument()
    expect(screen.getByText('Original')).toBeInTheDocument()
  })

  it('shows (edited) badge for edited messages', async () => {
    const msg = makeMsg('1', 'alice@test.com', 'Original')
    msg.editedContent = 'Edited version'
    vi.mocked(api.fetchChatMessages).mockResolvedValue([msg])

    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => {
      expect(screen.getByText('(edited)')).toBeInTheDocument()
      expect(screen.getByText('Edited version')).toBeInTheDocument()
    })
  })

  it('verifies chain and shows status', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    vi.mocked(api.verifyChannelChain).mockResolvedValue({
      intact: true,
      messageCount: 42,
      validCount: 42,
    })

    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)
    await user.click(screen.getByText('Verify'))

    await waitFor(() => {
      expect(screen.getByText('Chain OK (42 msgs)')).toBeInTheDocument()
    })
  })

  it('shows broken chain status', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    vi.mocked(api.verifyChannelChain).mockResolvedValue({
      intact: false,
      messageCount: 10,
      validCount: 7,
    })

    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)
    await user.click(screen.getByText('Verify'))

    await waitFor(() => {
      expect(screen.getByText('Chain broken at 7/10')).toBeInTheDocument()
    })
  })

  it('shows hash for messages with hash', async () => {
    const msg = makeMsg('1', 'alice@test.com', 'Hello')
    msg.hash = 'abcdef1234567890abcdef'
    msg.prevHash = 'prev1234567890'
    vi.mocked(api.fetchChatMessages).mockResolvedValue([msg])

    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => {
      expect(screen.getByText('abcdef1234567890...')).toBeInTheDocument()
    })
  })

  it('shows date separators between different days', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([
      makeMsg('1', 'alice@test.com', 'Day 1 msg', '2026-01-14T10:00:00Z'),
      makeMsg('2', 'alice@test.com', 'Day 2 msg', '2026-01-15T10:00:00Z'),
    ])

    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => {
      expect(screen.getByText('Day 1 msg')).toBeInTheDocument()
      expect(screen.getByText('Day 2 msg')).toBeInTheDocument()
    })
  })

  it('shows lock icon for encrypted channel', () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    vi.mocked(api.fetchChannelKeys).mockResolvedValue([])
    const encryptedChannel = { ...baseChannel, encrypted: true, currentKeyVersion: 1 }
    render(<MessageArea channel={encryptedChannel} />)
    expect(screen.getByText(/general/)).toBeInTheDocument()
  })

  it('shows singular member for count of 1', () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    render(<MessageArea channel={{ ...baseChannel, memberCount: 1 }} />)
    expect(screen.getByText('1 member')).toBeInTheDocument()
  })

  it('shows error when send fails', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    vi.mocked(api.sendChatMessage).mockRejectedValue(new Error('fail'))

    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)

    const textarea = screen.getByPlaceholderText('Message #general')
    await user.type(textarea, 'test')
    await user.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(screen.getByText('Failed to send message')).toBeInTheDocument()
    })
  })

  it('shows error when verify fails', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    vi.mocked(api.verifyChannelChain).mockRejectedValue(new Error('fail'))

    const user = userEvent.setup()
    render(<MessageArea channel={baseChannel} />)
    await user.click(screen.getByText('Verify'))

    await waitFor(() => {
      expect(screen.getByText('Failed to verify chain')).toBeInTheDocument()
    })
  })

  it('marks channel as read on load', async () => {
    vi.mocked(api.fetchChatMessages).mockResolvedValue([])
    render(<MessageArea channel={baseChannel} />)
    await waitFor(() => {
      expect(api.markChannelRead).toHaveBeenCalledWith(1)
    })
  })
})
