import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PendingApproval from './PendingApproval'
import { fetchApprovalStatus } from '../services/api'

const mockLogout = vi.fn()
const mockRefreshPermissions = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    refreshPermissions: mockRefreshPermissions,
    isAuthenticated: true,
    email: 'test@example.com',
    permissions: [],
    hasPermission: () => false,
  }),
}))

vi.mock('../services/api', () => ({
  fetchApprovalStatus: vi.fn().mockResolvedValue({ status: 'PENDING' }),
}))

const mockFetchApprovalStatus = vi.mocked(fetchApprovalStatus)

beforeEach(() => {
  mockLogout.mockReset()
  mockRefreshPermissions.mockReset()
  mockFetchApprovalStatus.mockReset()
  mockFetchApprovalStatus.mockResolvedValue({ status: 'PENDING' })
})

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

  it('shows declined status without reason', async () => {
    mockFetchApprovalStatus.mockResolvedValue({ status: 'DECLINED' })
    render(<PendingApproval />)
    expect(await screen.findByText('Registration Declined')).toBeInTheDocument()
    expect(screen.getByText(/could not be approved/)).toBeInTheDocument()
  })

  it('shows declined status with reason', async () => {
    mockFetchApprovalStatus.mockResolvedValue({ status: 'DECLINED', reason: 'Suspicious activity' })
    render(<PendingApproval />)
    expect(await screen.findByText('Registration Declined')).toBeInTheDocument()
    expect(screen.getByText(/Suspicious activity/)).toBeInTheDocument()
  })

  it('calls refreshPermissions when status is APPROVED', async () => {
    mockRefreshPermissions.mockResolvedValue(undefined)
    mockFetchApprovalStatus.mockResolvedValue({ status: 'APPROVED' })
    render(<PendingApproval />)
    await waitFor(() => {
      expect(mockRefreshPermissions).toHaveBeenCalled()
    })
  })
})
