import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { setPermissionsChangedCallback } from '../services/api'

vi.mock('../services/api', () => ({
  setPermissionsChangedCallback: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
  vi.mocked(setPermissionsChangedCallback).mockReset()
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('AuthContext', () => {
  it('initial state is not authenticated when no email in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.email).toBeNull()
  })

  it('initial state is authenticated when email exists in localStorage', () => {
    localStorage.setItem('email', 'test@example.com')
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('test@example.com')
  })

  it('login sets user and stores email in localStorage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'user@test.com', permissions: ['METRICS'], groups: ['Users'] }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('user@test.com')
    expect(result.current.permissions).toEqual(['METRICS'])
    expect(result.current.groups).toEqual(['Users'])
    expect(localStorage.getItem('email')).toBe('user@test.com')
  })

  it('login failure throws error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await expect(
      act(async () => {
        await result.current.login('bad@test.com', 'wrong')
      }),
    ).rejects.toThrow('Invalid credentials')

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('logout clears user and removes email from localStorage', async () => {
    // Start logged in
    localStorage.setItem('email', 'user@test.com')
    localStorage.setItem('permissions', '["METRICS"]')
    localStorage.setItem('groups', '["Users"]')
    mockFetch.mockResolvedValueOnce({ ok: true }) // logout fetch

    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.email).toBeNull()
    expect(result.current.permissions).toEqual([])
    expect(localStorage.getItem('email')).toBeNull()
    expect(localStorage.getItem('permissions')).toBeNull()
    expect(localStorage.getItem('groups')).toBeNull()
  })

  it('logout calls /api/auth/logout endpoint', async () => {
    localStorage.setItem('email', 'user@test.com')
    mockFetch.mockResolvedValueOnce({ ok: true })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      result.current.logout()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
  })

  it('hasPermission returns correct results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'user@test.com', permissions: ['METRICS', 'PLAY'], groups: ['Users'] }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(result.current.hasPermission('METRICS')).toBe(true)
    expect(result.current.hasPermission('PLAY')).toBe(true)
    expect(result.current.hasPermission('MANAGE_USERS')).toBe(false)
  })

  it('login sends correct payload to /api/auth/login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'user@test.com', permissions: [], groups: [] }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'pass')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'user@test.com', password: 'pass' }),
    }))
  })

  it('useAuth throws when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })

  it('registers permissions changed callback when authenticated', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'user@test.com', permissions: ['METRICS'], groups: ['Users'] }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(setPermissionsChangedCallback).toHaveBeenCalledWith(expect.any(Function))
  })

  it('refresh callback updates permissions from /api/auth/refresh', async () => {
    // Login first
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'user@test.com', permissions: ['METRICS'], groups: ['Users'] }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    // Get the callback that was registered
    const calls = vi.mocked(setPermissionsChangedCallback).mock.calls
    const refreshCallback = calls.find(c => typeof c[0] === 'function')?.[0] as () => Promise<void>
    expect(refreshCallback).toBeDefined()

    // Mock the refresh response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'user@test.com', permissions: ['METRICS', 'PLAY'], groups: ['Users', 'Gamers'] }),
    })

    await act(async () => {
      await refreshCallback()
    })

    expect(result.current.permissions).toEqual(['METRICS', 'PLAY'])
    expect(result.current.groups).toEqual(['Users', 'Gamers'])
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({ method: 'POST' }))
  })
})
