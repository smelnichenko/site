import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'

vi.mock('../hooks/useHashcash', () => ({
  useHashcash: () => ({
    enabled: false,
    solving: false,
    solve: vi.fn().mockResolvedValue({ challenge: '', nonce: '' }),
  }),
}))

vi.mock('../services/api', () => ({
  fetchApprovalMode: vi.fn().mockResolvedValue({ mode: 'skip' }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
}

describe('Register', () => {
  it('renders register form with email, password, and confirm fields', () => {
    renderRegister()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument()
  })

  it('calls register API on form submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'new@test.com' }),
    })
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText('Email'), 'new@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'new@test.com', password: 'password123' }),
    }))
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText('Email'), 'new@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm Password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Email already registered' }),
    })
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText('Email'), 'existing@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })

  it('has link to login page', () => {
    renderRegister()
    expect(screen.getByText('Login')).toHaveAttribute('href', '/login')
  })
})
