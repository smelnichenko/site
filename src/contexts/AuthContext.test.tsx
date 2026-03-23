import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import * as keyStore from '../services/keyStore'
import * as oidcClient from '../services/oidcClient'

vi.mock('../services/oidcClient', () => ({
  trySilentAuth: vi.fn(),
  handleCallback: vi.fn(),
  logout: vi.fn(),
  getAccessToken: vi.fn(),
  refreshAndGetUserInfo: vi.fn(),
}))

vi.mock('../services/keyStore', () => ({
  setIdentityKeys: vi.fn(),
  clear: vi.fn(),
}))

// Mock location.href setter to prevent jsdom navigation errors from Keycloak logout redirect
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

beforeEach(() => {
  vi.mocked(oidcClient.trySilentAuth).mockResolvedValue(null)
  vi.mocked(oidcClient.handleCallback).mockReset()
  vi.mocked(oidcClient.logout).mockReset()
  vi.mocked(oidcClient.getAccessToken).mockReset()
  vi.mocked(oidcClient.refreshAndGetUserInfo).mockReset()
  vi.mocked(keyStore.clear).mockReset()
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('AuthContext', () => {
  it('initial state is not authenticated when no session exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.initializing).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.email).toBeNull()
  })

  it('restores session via silent auth on mount', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValue({
      email: 'test@example.com',
      uuid: 'abc-123',
      permissions: ['METRICS'],
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.initializing).toBe(false))
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('test@example.com')
    expect(result.current.permissions).toEqual(['METRICS'])
  })

  it('handleCallback sets user state from OIDC token', async () => {
    vi.mocked(oidcClient.handleCallback).mockResolvedValue({
      email: 'user@test.com',
      uuid: 'uuid-1',
      permissions: ['METRICS'],
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.initializing).toBe(false))

    await act(async () => {
      await result.current.handleCallback('auth-code')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('user@test.com')
    expect(result.current.permissions).toEqual(['METRICS'])
  })

  it('handleCallback failure throws error', async () => {
    vi.mocked(oidcClient.handleCallback).mockRejectedValue(new Error('Token exchange failed'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.initializing).toBe(false))

    await expect(
      act(async () => {
        await result.current.handleCallback('bad-code')
      }),
    ).rejects.toThrow('Token exchange failed')

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('logout clears state and calls oidcClient.logout', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValue({
      email: 'user@test.com',
      uuid: 'uuid-1',
      permissions: ['METRICS'],
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await act(async () => {
      result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.email).toBeNull()
    expect(result.current.permissions).toEqual([])
    expect(oidcClient.logout).toHaveBeenCalled()
  })

  it('logout clears keyStore', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValue({
      email: 'user@test.com',
      uuid: 'uuid-1',
      permissions: [],
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await act(async () => {
      result.current.logout()
    })

    expect(keyStore.clear).toHaveBeenCalled()
  })

  it('hasPermission returns correct results', async () => {
    vi.mocked(oidcClient.handleCallback).mockResolvedValue({
      email: 'user@test.com',
      uuid: 'uuid-1',
      permissions: ['METRICS', 'PLAY'],
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.initializing).toBe(false))

    await act(async () => {
      await result.current.handleCallback('code')
    })

    expect(result.current.hasPermission('METRICS')).toBe(true)
    expect(result.current.hasPermission('PLAY')).toBe(true)
    expect(result.current.hasPermission('MANAGE_USERS')).toBe(false)
  })

  it('useAuth throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })

  it('refreshPermissions updates state from refreshed token', async () => {
    vi.mocked(oidcClient.handleCallback).mockResolvedValue({
      email: 'user@test.com',
      uuid: 'uuid-1',
      permissions: ['METRICS'],
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.initializing).toBe(false))

    await act(async () => {
      await result.current.handleCallback('code')
    })

    expect(result.current.permissions).toEqual(['METRICS'])

    vi.mocked(oidcClient.refreshAndGetUserInfo).mockResolvedValue({
      email: 'user@test.com',
      uuid: 'uuid-1',
      permissions: ['METRICS', 'PLAY'],
    })

    await act(async () => {
      await result.current.refreshPermissions()
    })

    expect(result.current.permissions).toEqual(['METRICS', 'PLAY'])
  })
})
