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

  it('shows error when toggle enabled fails with Error', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.setUserEnabled).mockRejectedValue(new Error('Cannot disable self'))

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getAllByText('Disable').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('Disable')[0])
    await waitFor(() => {
      expect(screen.getByText('Cannot disable self')).toBeInTheDocument()
    })
  })

  it('shows generic error when toggle enabled fails with non-Error', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.setUserEnabled).mockRejectedValue('string error')

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getAllByText('Disable').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('Disable')[0])
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })
  })

  it('opens user group editing and saves', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.setUserGroups).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })

    // Click the groups button for user with groups (shows "Admins")
    await user.click(screen.getByTitle('Click to edit groups', { exact: false }))

    // Group checkboxes should appear
    await waitFor(() => {
      expect(screen.getByLabelText('Admins')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Users')).toBeInTheDocument()

    // Admins should be checked (user is in Admins group)
    expect(screen.getByLabelText('Admins')).toBeChecked()

    // Toggle Users group on
    await user.click(screen.getByLabelText('Users'))

    // Save
    await user.click(screen.getByText('Save'))
    expect(api.setUserGroups).toHaveBeenCalledWith(1, [1, 2])
  })

  it('cancels user group editing', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })

    // Open group editing
    await user.click(screen.getByTitle('Click to edit groups', { exact: false }))
    await waitFor(() => {
      expect(screen.getByLabelText('Admins')).toBeInTheDocument()
    })

    // Cancel
    await user.click(screen.getByText('Cancel'))

    // Checkboxes should disappear
    expect(screen.queryByLabelText('Admins')).not.toBeInTheDocument()
  })

  it('toggles group selection off when editing user groups', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.setUserGroups).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Click to edit groups', { exact: false }))
    await waitFor(() => {
      expect(screen.getByLabelText('Admins')).toBeChecked()
    })

    // Uncheck Admins
    await user.click(screen.getByLabelText('Admins'))
    expect(screen.getByLabelText('Admins')).not.toBeChecked()

    await user.click(screen.getByText('Save'))
    expect(api.setUserGroups).toHaveBeenCalledWith(1, [])
  })

  it('shows error when saving user groups fails', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.setUserGroups).mockRejectedValue(new Error('Cannot remove own admin'))

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })

    await user.click(screen.getByTitle('Click to edit groups', { exact: false }))
    await waitFor(() => {
      expect(screen.getByLabelText('Admins')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(screen.getByText('Cannot remove own admin')).toBeInTheDocument()
    })
  })

  it('shows None for user with no groups', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('None')).toBeInTheDocument()
    })
  })

  it('edits an existing group', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.updateGroup).mockResolvedValue({ ...mockGroups[0], description: 'Updated' })

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    // Click Edit on the first group (Admins)
    await user.click(screen.getAllByText('Edit')[0])

    // Form should show "Edit Group" heading and be pre-filled
    expect(screen.getByText('Edit Group')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Admins')
    expect(screen.getByLabelText('Description')).toHaveValue('Full access')

    // MANAGE_USERS should be checked
    expect(screen.getByLabelText('MANAGE_USERS')).toBeChecked()

    // Update description
    await user.clear(screen.getByLabelText('Description'))
    await user.type(screen.getByLabelText('Description'), 'Updated')
    await user.click(screen.getByText('Save'))

    expect(api.updateGroup).toHaveBeenCalledWith(1, 'Admins', 'Updated', ['MANAGE_USERS'])
  })

  it('toggles permissions in group form', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.createGroup).mockResolvedValue({ id: 3, name: 'Test', description: '', permissions: [], createdAt: '2026-01-01T00:00:00Z' })

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('+ New Group'))

    // Toggle PLAY permission on
    await user.click(screen.getByLabelText('PLAY'))
    expect(screen.getByLabelText('PLAY')).toBeChecked()

    // Toggle CHAT permission on
    await user.click(screen.getByLabelText('CHAT'))
    expect(screen.getByLabelText('CHAT')).toBeChecked()

    // Toggle PLAY permission off
    await user.click(screen.getByLabelText('PLAY'))
    expect(screen.getByLabelText('PLAY')).not.toBeChecked()

    await user.type(screen.getByLabelText('Name'), 'Test')
    await user.click(screen.getByText('Save'))

    expect(api.createGroup).toHaveBeenCalledWith('Test', '', ['CHAT'])
  })

  it('cancels group form', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('+ New Group'))
    expect(screen.getByText('New Group')).toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))
    expect(screen.queryByText('New Group')).not.toBeInTheDocument()
  })

  it('shows error when saving group fails', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.createGroup).mockRejectedValue(new Error('Group name taken'))

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('+ New Group'))
    await user.type(screen.getByLabelText('Name'), 'Admins')
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText('Group name taken')).toBeInTheDocument()
    })
  })

  it('shows error when deleting group fails', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    vi.mocked(api.deleteGroup).mockRejectedValue(new Error('Cannot delete'))

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('Delete'))

    await waitFor(() => {
      expect(screen.getByText('Cannot delete')).toBeInTheDocument()
    })
  })

  it('does not delete group when confirm is cancelled', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)
    globalThis.confirm = vi.fn(() => false)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('Delete'))

    expect(api.deleteGroup).not.toHaveBeenCalled()
  })

  it('shows No permissions for group without permissions', async () => {
    const groupsWithNoPerms = [
      { id: 1, name: 'Admins', description: 'Full access', permissions: [{ id: 1, permission: 'MANAGE_USERS' }], createdAt: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Empty', description: null, permissions: [], createdAt: '2026-01-01T00:00:00Z' },
    ]
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(groupsWithNoPerms)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    expect(screen.getByText('No permissions')).toBeInTheDocument()
  })

  it('disables save button when group name is empty', async () => {
    vi.mocked(api.fetchAdminUsers).mockResolvedValue(mockUsers)
    vi.mocked(api.fetchAdminGroups).mockResolvedValue(mockGroups)

    const user = userEvent.setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: 'Groups' }))

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    await user.click(screen.getByText('+ New Group'))

    expect(screen.getByText('Save')).toBeDisabled()
  })
})
