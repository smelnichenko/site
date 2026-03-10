import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateChannelModal from './CreateChannelModal'

vi.mock('../../services/api', () => ({
  createChatChannel: vi.fn(),
  setChannelKeys: vi.fn(),
}))

vi.mock('../../services/crypto', () => ({
  generateChannelKey: vi.fn(),
  wrapChannelKeyForMember: vi.fn(),
}))

vi.mock('../../services/keyStore', () => ({
  hasIdentityKeys: vi.fn(() => false),
  getIdentityPublicKey: vi.fn(),
  setChannelKey: vi.fn(),
}))

const api = await import('../../services/api')

beforeEach(() => {
  vi.mocked(api.createChatChannel).mockReset()
  // Mock HTMLDialogElement.showModal since jsdom doesn't support it
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

describe('CreateChannelModal', () => {
  it('renders create channel form', () => {
    render(<CreateChannelModal onCreated={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Create Channel')).toBeInTheDocument()
    expect(screen.getByLabelText('Channel Name')).toBeInTheDocument()
  })

  it('calls showModal on mount', () => {
    render(<CreateChannelModal onCreated={vi.fn()} onClose={vi.fn()} />)
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('creates channel on submit', async () => {
    const onCreated = vi.fn()
    vi.mocked(api.createChatChannel).mockResolvedValue({
      id: 1, name: 'test', createdAt: '', memberCount: 1,
      joined: true, isOwner: true, unreadCount: 0, encrypted: false, currentKeyVersion: 0,
    })

    const user = userEvent.setup()
    render(<CreateChannelModal onCreated={onCreated} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Channel Name'), 'test-channel')
    await user.click(screen.getByText('Create'))

    expect(api.createChatChannel).toHaveBeenCalledWith('test-channel', false)
    expect(onCreated).toHaveBeenCalled()
  })

  it('shows error on failure', async () => {
    vi.mocked(api.createChatChannel).mockRejectedValue(new Error('Name taken'))

    const user = userEvent.setup()
    render(<CreateChannelModal onCreated={vi.fn()} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Channel Name'), 'test')
    await user.click(screen.getByText('Create'))

    expect(await screen.findByText('Name taken')).toBeInTheDocument()
  })

  it('calls onClose when Close button clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CreateChannelModal onCreated={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('disables Create button when name is empty', () => {
    render(<CreateChannelModal onCreated={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Create')).toBeDisabled()
  })
})
