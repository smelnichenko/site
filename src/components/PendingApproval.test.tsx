import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PendingApproval from './PendingApproval'

const mockLogout = vi.fn()
const mockRefreshPermissions = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    refreshPermissions: mockRefreshPermissions,
    isAuthenticated: true,
    email: 'test@example.com',
    permissions: [],
    groups: [],
    hasPermission: () => false,
  }),
}))

vi.mock('../services/api', () => ({
  fetchApprovalStatus: vi.fn().mockResolvedValue({ status: 'PENDING', reason: null }),
}))

describe('PendingApproval', () => {
  it('shows pending approval message', () => {
    render(<PendingApproval />)
    expect(screen.getByText('Account Pending Approval')).toBeInTheDocument()
    expect(screen.getByText(/pending approval/)).toBeInTheDocument()
  })

  it('shows logout button that calls logout', async () => {
    const user = userEvent.setup()
    render(<PendingApproval />)
    await user.click(screen.getByText('Logout'))
    expect(mockLogout).toHaveBeenCalled()
  })
})
