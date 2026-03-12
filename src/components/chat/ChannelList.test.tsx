import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChannelList from './ChannelList'

const mockChannels = [
  { id: 1, name: 'general', createdAt: '2026-01-01T00:00:00Z', memberCount: 3, joined: true, isOwner: true, isSystem: false, unreadCount: 0, encrypted: false, currentKeyVersion: 0 },
  { id: 2, name: 'random', createdAt: '2026-01-01T00:00:00Z', memberCount: 2, joined: true, isOwner: false, isSystem: false, unreadCount: 5, encrypted: false, currentKeyVersion: 0 },
  { id: 3, name: 'secret', createdAt: '2026-01-01T00:00:00Z', memberCount: 1, joined: true, isOwner: true, isSystem: false, unreadCount: 0, encrypted: true, currentKeyVersion: 1 },
]

const defaultProps = {
  channels: mockChannels,
  activeChannelId: null as number | null,
  onSelectChannel: vi.fn(),
  onCreateChannel: vi.fn(),
  onLeaveChannel: vi.fn(),
  onInvite: vi.fn(),
  onDeleteChannel: vi.fn(),
  onManageMembers: vi.fn(),
}

describe('ChannelList', () => {
  it('renders channel names', () => {
    render(<ChannelList {...defaultProps} />)
    expect(screen.getByText(/general/)).toBeInTheDocument()
    expect(screen.getByText(/random/)).toBeInTheDocument()
  })

  it('shows member count', () => {
    render(<ChannelList {...defaultProps} />)
    expect(screen.getByText('3 members')).toBeInTheDocument()
    expect(screen.getByText('2 members')).toBeInTheDocument()
    expect(screen.getByText('1 member')).toBeInTheDocument()
  })

  it('shows unread count badge', () => {
    render(<ChannelList {...defaultProps} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('calls onSelectChannel when channel clicked', async () => {
    const onSelectChannel = vi.fn()
    const user = userEvent.setup()
    render(<ChannelList {...defaultProps} onSelectChannel={onSelectChannel} />)
    // Click on the channel button containing 'general'
    const buttons = screen.getAllByRole('button')
    const generalButton = buttons.find(b => b.textContent?.includes('general'))
    if (generalButton) await user.click(generalButton)
    expect(onSelectChannel).toHaveBeenCalledWith(1)
  })

  it('calls onCreateChannel when + New clicked', async () => {
    const onCreateChannel = vi.fn()
    const user = userEvent.setup()
    render(<ChannelList {...defaultProps} onCreateChannel={onCreateChannel} />)
    await user.click(screen.getByText('+ New'))
    expect(onCreateChannel).toHaveBeenCalled()
  })

  it('shows Members button for owned channels', () => {
    render(<ChannelList {...defaultProps} />)
    const membersButtons = screen.getAllByText('Members')
    expect(membersButtons.length).toBe(2) // general and secret are owned
  })

  it('shows Invite button for owned channels', () => {
    render(<ChannelList {...defaultProps} />)
    const inviteButtons = screen.getAllByText('Invite')
    expect(inviteButtons.length).toBe(2)
  })

  it('shows Delete for owned channels and Leave for non-owned', () => {
    render(<ChannelList {...defaultProps} />)
    expect(screen.getAllByText('Delete').length).toBe(2) // general and secret
    expect(screen.getAllByText('Leave').length).toBe(1) // random
  })

  it('shows empty state when no channels', () => {
    render(<ChannelList {...defaultProps} channels={[]} />)
    expect(screen.getByText(/No channels yet/)).toBeInTheDocument()
  })

  it('shows lock icon for encrypted channels', () => {
    render(<ChannelList {...defaultProps} />)
    // The encrypted channel 'secret' should have a lock prefix
    expect(screen.getByText(/🔒.*secret/)).toBeInTheDocument()
  })

  it('calls onManageMembers when Members clicked', async () => {
    const onManageMembers = vi.fn()
    const user = userEvent.setup()
    render(<ChannelList {...defaultProps} onManageMembers={onManageMembers} />)
    const membersButtons = screen.getAllByText('Members')
    await user.click(membersButtons[0])
    expect(onManageMembers).toHaveBeenCalledWith(1) // general channel id
  })

  it('calls onInvite when Invite clicked', async () => {
    const onInvite = vi.fn()
    const user = userEvent.setup()
    render(<ChannelList {...defaultProps} onInvite={onInvite} />)
    const inviteButtons = screen.getAllByText('Invite')
    await user.click(inviteButtons[0])
    expect(onInvite).toHaveBeenCalledWith(1)
  })

  it('calls onDeleteChannel when Delete confirmed', async () => {
    const onDeleteChannel = vi.fn()
    globalThis.confirm = vi.fn(() => true)
    const user = userEvent.setup()
    render(<ChannelList {...defaultProps} onDeleteChannel={onDeleteChannel} />)
    const deleteButtons = screen.getAllByText('Delete')
    await user.click(deleteButtons[0])
    expect(globalThis.confirm).toHaveBeenCalled()
    expect(onDeleteChannel).toHaveBeenCalledWith(1)
  })

  it('does not delete when confirm cancelled', async () => {
    const onDeleteChannel = vi.fn()
    globalThis.confirm = vi.fn(() => false)
    const user = userEvent.setup()
    render(<ChannelList {...defaultProps} onDeleteChannel={onDeleteChannel} />)
    const deleteButtons = screen.getAllByText('Delete')
    await user.click(deleteButtons[0])
    expect(onDeleteChannel).not.toHaveBeenCalled()
  })

  it('calls onLeaveChannel when Leave clicked', async () => {
    const onLeaveChannel = vi.fn()
    const user = userEvent.setup()
    render(<ChannelList {...defaultProps} onLeaveChannel={onLeaveChannel} />)
    await user.click(screen.getByText('Leave'))
    expect(onLeaveChannel).toHaveBeenCalledWith(2) // random channel id
  })

  it('highlights active channel', () => {
    render(<ChannelList {...defaultProps} activeChannelId={1} />)
    const generalButton = screen.getAllByRole('button').find(b => b.textContent?.includes('general'))
    // Background is on the parent div wrapper, not the button itself
    expect(generalButton?.parentElement?.style.background).toBe('rgb(232, 240, 254)')
  })
})
