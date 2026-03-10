import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PendingApproval from './PendingApproval'

const mockLogout = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    isAuthenticated: true,
    email: 'test@example.com',
    permissions: [],
    groups: [],
    hasPermission: () => false,
  }),
}))

describe('PendingApproval', () => {
  it('shows pending approval message', () => {
    render(<PendingApproval />)
    expect(screen.getByText('Account Pending Approval')).toBeInTheDocument()
    expect(screen.getByText(/not yet approved/)).toBeInTheDocument()
  })

  it('shows logout button that calls logout', async () => {
    const user = userEvent.setup()
    render(<PendingApproval />)
    await user.click(screen.getByText('Logout'))
    expect(mockLogout).toHaveBeenCalled()
  })
})
