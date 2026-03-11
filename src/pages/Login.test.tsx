import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()
let mockLocationState: unknown = null

vi.mock('../hooks/useHashcash', () => ({
  useHashcash: () => ({
    enabled: false,
    solving: false,
    solve: vi.fn().mockResolvedValue({ challenge: '', nonce: '' }),
  }),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
    email: null,
    permissions: [],
    groups: [],
    hasPermission: () => false,
    logout: vi.fn(),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState, pathname: '/login', search: '', hash: '', key: '' }),
  }
})

beforeEach(() => {
  mockLogin.mockReset()
  mockNavigate.mockReset()
  mockLocationState = null
})

async function submitLogin() {
  const user = userEvent.setup()
  renderLogin()
  await user.type(screen.getByLabelText('Email'), 'test@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Login' }))
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  it('renders login form with email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('calls login on form submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', undefined)
  })

  it('navigates to / on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'))
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  it('has link to register page', () => {
    renderLogin()
    expect(screen.getByText('Register')).toHaveAttribute('href', '/register')
  })

  describe('resend verification', () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      mockFetch.mockReset()
      vi.stubGlobal('fetch', mockFetch)
    })

    it('shows resend button when login fails with verify email error', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Please verify your email before logging in'))
      const user = userEvent.setup()
      renderLogin()

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Login' }))

      expect(await screen.findByRole('button', { name: 'Resend verification email' })).toBeInTheDocument()
    })

    it('does not show resend button for other errors', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'))
      const user = userEvent.setup()
      renderLogin()

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'wrong')
      await user.click(screen.getByRole('button', { name: 'Login' }))

      await screen.findByText('Invalid credentials')
      expect(screen.queryByRole('button', { name: 'Resend verification email' })).not.toBeInTheDocument()
    })

    it('calls resend-verification API and shows success', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Please verify your email before logging in'))
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      const user = userEvent.setup()
      renderLogin()

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Login' }))

      await screen.findByRole('button', { name: 'Resend verification email' })
      await user.click(screen.getByRole('button', { name: 'Resend verification email' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
        }))
      })
      expect(await screen.findByText(/new verification link has been sent/i)).toBeInTheDocument()
    })
  })

  describe('redirect logic', () => {
    it('redirects to from location state when valid', async () => {
      mockLogin.mockResolvedValueOnce(undefined)
      mockLocationState = { from: '/dashboard' }
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })

    it('redirects to lastPath when no from state', async () => {
      mockLogin.mockResolvedValueOnce('/rss')
      mockLocationState = null
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/rss', { replace: true })
    })

    it('prefers from over lastPath when both are available', async () => {
      mockLogin.mockResolvedValueOnce('/rss')
      mockLocationState = { from: '/dashboard' }
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })

    it('redirects to / when neither from nor lastPath are available', async () => {
      mockLogin.mockResolvedValueOnce(undefined)
      mockLocationState = null
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('redirects to / when from is /', async () => {
      mockLogin.mockResolvedValueOnce(undefined)
      mockLocationState = { from: '/' }
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('ignores from that does not start with /', async () => {
      mockLogin.mockResolvedValueOnce(undefined)
      mockLocationState = { from: 'http://evil.com' }
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('ignores from that starts with //', async () => {
      mockLogin.mockResolvedValueOnce(undefined)
      mockLocationState = { from: '//evil.com' }
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('ignores lastPath that does not start with /', async () => {
      mockLogin.mockResolvedValueOnce('http://evil.com')
      mockLocationState = null
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('ignores lastPath that starts with //', async () => {
      mockLogin.mockResolvedValueOnce('//evil.com')
      mockLocationState = null
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('falls back to lastPath when from is invalid', async () => {
      mockLogin.mockResolvedValueOnce('/chat')
      mockLocationState = { from: '//evil.com' }
      await submitLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/chat', { replace: true })
    })
  })
})
