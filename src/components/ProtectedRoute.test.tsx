import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { AuthProvider } from '../contexts/AuthContext'
import * as oidcClient from '../services/oidcClient'

vi.mock('../services/oidcClient', () => ({
  trySilentAuth: vi.fn(),
  handleCallback: vi.fn(),
  logout: vi.fn(),
  getAccessToken: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  isAuthenticated: vi.fn().mockReturnValue(false),
  refreshAndGetUserInfo: vi.fn(),
}))

vi.mock('../services/keyStore', () => ({
  clear: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(oidcClient.trySilentAuth).mockReset()
})

function renderWithRoute(initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/protected" element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          } />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('renders children when authenticated', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce({
      email: 'test@example.com',
      uuid: 'uuid-1',
      permissions: ['METRICS'],
    })

    renderWithRoute()
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })
  })

  it('redirects to /login when not authenticated', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce(null)

    renderWithRoute()
    await waitFor(() => {
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })
})
