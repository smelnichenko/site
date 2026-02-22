import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from './ResetPassword'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock useSearchParams
let mockToken = 'valid-token'
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(`token=${mockToken}`)],
  }
})

beforeEach(() => {
  mockFetch.mockReset()
  mockToken = 'valid-token'
})

function renderResetPassword() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>,
  )
}

describe('ResetPassword', () => {
  it('renders reset password form', () => {
    renderResetPassword()
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument()
  })

  it('calls reset-password API with token and new password', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Password reset successfully' }),
    })
    const user = userEvent.setup()
    renderResetPassword()

    await user.type(screen.getByLabelText('New Password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/reset-password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'newpass123' }),
    }))
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderResetPassword()

    await user.type(screen.getByLabelText('New Password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm Password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows success message after successful reset', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'OK' }),
    })
    const user = userEvent.setup()
    renderResetPassword()

    await user.type(screen.getByLabelText('New Password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm Password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(await screen.findByText('Your password has been reset successfully.')).toBeInTheDocument()
    expect(screen.getByText('Login with your new password')).toHaveAttribute('href', '/login')
  })
})
