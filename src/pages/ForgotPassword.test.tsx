import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from './ForgotPassword'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function renderForgotPassword() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  )
}

describe('ForgotPassword', () => {
  it('renders email form with submit button', () => {
    renderForgotPassword()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument()
  })

  it('calls forgot-password API on submit', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByLabelText('Email'), 'user@test.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/forgot-password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com' }),
    }))
  })

  it('shows success message after submit (no email enumeration)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByLabelText('Email'), 'user@test.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByText(/reset link has been sent/i)).toBeInTheDocument()
  })
})
