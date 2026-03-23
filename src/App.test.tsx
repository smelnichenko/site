import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { LoadingProvider } from './contexts/LoadingContext'

// Mock oidcClient to prevent actual OIDC calls
vi.mock('./services/oidcClient', () => ({
  trySilentAuth: vi.fn().mockResolvedValue(null),
  handleCallback: vi.fn(),
  logout: vi.fn(),
  getAccessToken: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  isAuthenticated: vi.fn().mockReturnValue(false),
  refreshAndGetUserInfo: vi.fn(),
}))

// Mock location.href to prevent jsdom navigation errors from Keycloak redirect
const originalLocation = globalThis.location
beforeAll(() => {
  Object.defineProperty(globalThis, 'location', {
    value: { ...originalLocation, href: originalLocation.href },
    writable: true,
    configurable: true,
  })
})
afterAll(() => {
  Object.defineProperty(globalThis, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  })
})

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
  it('renders without crashing', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument()
    })
  })

  it('renders login redirect at /login route', async () => {
    renderApp('/login')
    await waitFor(() => {
      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument()
    })
  })
})
