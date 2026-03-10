import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Admin from './Admin'

vi.mock('../services/api', () => ({
  fetchAdminUsers: vi.fn(),
  fetchAdminGroups: vi.fn(),
  setUserEnabled: vi.fn(),
  setUserGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
}))

const api = await import('../services/api')

const mockUsers = [
  { id: 1, email: 'admin@test.com', enabled: true, groups: ['Admins'], permissions: ['MANAGE_USERS'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, email: 'user@test.com', enabled: true, groups: [], permissions: [], createdAt: '2026-01-02T00:00:00Z' },
]

const mockGroups = [
  { id: 1, name: 'Admins', description: 'Full access', permissions: [{ id: 1, permission: 'MANAGE_USERS' }], createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'Users', description: null, permissions: [{ id: 2, permission: 'METRICS' }], createdAt: '2026-01-01T00:00:00Z' },
]

beforeEach(() => {
  vi.mocked(api.fetchAdminUsers).mockReset()
  vi.mocked(api.fetchAdminGroups).mockReset()
  vi.mocked(api.setUserEnabled).mockReset()
  vi.mocked(api.setUserGroups).mockReset()
  vi.mocked(api.createGroup).mockReset()
  vi.mocked(api.updateGroup).mockReset()
  vi.mocked(api.deleteGroup).mockReset()
  globalThis.confirm = vi.fn(() => true)
})

function renderAdmin() {
  return render(<Admin />)
}

describe('Admin', () => {
  it('renders users tab with user list', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
      expect(screen.getByText('user@test.com')).toBeInTheDocument()
    })
  })

  it('shows Active/Disabled status', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    renderAdmin()
    await waitFor(() => {
      const activeElements = screen.getAllByText('Active')
      expect(activeElements.length).toBeGreaterThan(0)
    })
  })

  it('toggles user enabled status', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.setUserEnabled).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getAllByText('Disable').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('Disable')[0])
    expect(api.setUserEnabled).toHaveBeenCalledWith(1, false)
  })

  it('switches to groups tab', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    expect(screen.getByText('Admins')).toBeInTheDocument()
    // 'Users' appears as both tab button and group name; verify the group row exists
    expect(screen.getAllByText('Users').length).toBeGreaterThanOrEqual(2)
  })

  it('opens new group form', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('+ New Group'))
    expect(screen.getByText('New Group')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('creates a new group', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.createGroup).mockResolvedValue({ id: 3, name: 'Editors', description: 'Edit access', permissions: [], createdAt: '2026-01-01T00:00:00Z' })

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('+ New Group'))
    await user.type(screen.getByLabelText('Name'), 'Editors')
    await user.type(screen.getByLabelText('Description'), 'Edit access')
    await user.click(screen.getByText('Save'))

    expect(api.createGroup).toHaveBeenCalledWith('Editors', 'Edit access', [])
  })

  it('deletes a group', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.deleteGroup).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    // Only Users group has Delete button (Admins doesn't)
    await user.click(screen.getByText('Delete'))
    expect(api.deleteGroup).toHaveBeenCalledWith(2)
  })

  it('shows error when load fails', async () => {
    vi.mocked(api.fetchAdminUsers).mockRejectedValue(new Error('fail'))
    vi.mocked(api.fetchAdminGroups).mockRejectedValue(new Error('fail'))

    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument()
    })
  })
})
