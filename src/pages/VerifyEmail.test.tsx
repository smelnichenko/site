import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VerifyEmail from './VerifyEmail'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

let mockToken = 'valid-token'
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [{ get: (key: string) => key === 'token' ? mockToken : null }],
  }
})

beforeEach(() => {
  mockFetch.mockReset()
  mockToken = 'valid-token'
})

function renderVerifyEmail() {
  return render(
    <MemoryRouter>
      <VerifyEmail />
    </MemoryRouter>,
  )
}

describe('VerifyEmail', () => {
  it('auto-calls verify API on mount with token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Verified' }),
    })
    renderVerifyEmail()

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-email', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token' }),
    }))
  })

  it('shows success message after verification', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Verified' }),
    })
    renderVerifyEmail()

    expect(await screen.findByText('Your email has been verified successfully.')).toBeInTheDocument()
    expect(screen.getByText('Login to your account')).toHaveAttribute('href', '/login')
  })

  it('shows error message on verification failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Token expired' }),
    })
    renderVerifyEmail()

    expect(await screen.findByText('Token expired')).toBeInTheDocument()
  })

  it('shows invalid link when no token present', () => {
    mockToken = ''
    renderVerifyEmail()

    expect(screen.getByText('Invalid Link')).toBeInTheDocument()
    expect(screen.getByText(/verification link is invalid/i)).toBeInTheDocument()
  })
})
