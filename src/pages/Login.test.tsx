import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

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
    useLocation: () => ({ state: null, pathname: '/login', search: '', hash: '', key: '' }),
  }
})

beforeEach(() => {
  mockLogin.mockReset()
  mockNavigate.mockReset()
})

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

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
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
})
