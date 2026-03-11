import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { LoadingProvider } from './contexts/LoadingContext'

vi.mock('./hooks/useHashcash', () => ({
  useHashcash: () => ({
    enabled: false,
    solving: false,
    solve: vi.fn().mockResolvedValue({ challenge: '', nonce: '' }),
  }),
}))

// Mock fetch to prevent network calls
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: false,
  status: 200,
  json: () => Promise.resolve({}),
}))

function renderApp(route = '/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('renders without crashing', () => {
    renderApp()
    // The login page should render for unauthenticated users
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('renders login page at /login route', () => {
    renderApp('/login')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })
})
