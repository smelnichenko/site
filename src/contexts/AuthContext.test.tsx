import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { setPermissionsChangedCallback, fetchUserKeys, uploadUserKeys } from '../services/api'
import * as keyStore from '../services/keyStore'
import {
  generateIdentityKeyPair,
  deriveWrappingKey,
  decryptPrivateKey,
  encryptPrivateKey,
  importPublicKey,
  exportPublicKey,
  generateSalt,
  base64ToBuffer,
  bufferToBase64,
} from '../services/crypto'

vi.mock('../services/api', () => ({
  setPermissionsChangedCallback: vi.fn(),
  fetchUserKeys: vi.fn(),
  uploadUserKeys: vi.fn(),
}))

vi.mock('../services/crypto', () => ({
  generateIdentityKeyPair: vi.fn(),
  deriveWrappingKey: vi.fn(),
  decryptPrivateKey: vi.fn(),
  encryptPrivateKey: vi.fn(),
  importPublicKey: vi.fn(),
  exportPublicKey: vi.fn(),
  generateSalt: vi.fn(),
  base64ToBuffer: vi.fn(),
  bufferToBase64: vi.fn(),
}))

vi.mock('../services/keyStore', () => ({
  setIdentityKeys: vi.fn(),
  clear: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
  vi.mocked(setPermissionsChangedCallback).mockReset()
  vi.mocked(fetchUserKeys).mockReset()
  vi.mocked(uploadUserKeys).mockReset()
  vi.mocked(generateIdentityKeyPair).mockReset()
  vi.mocked(deriveWrappingKey).mockReset()
  vi.mocked(decryptPrivateKey).mockReset()
  vi.mocked(encryptPrivateKey).mockReset()
  vi.mocked(importPublicKey).mockReset()
  vi.mocked(exportPublicKey).mockReset()
  vi.mocked(generateSalt).mockReset()
  vi.mocked(base64ToBuffer).mockReset()
  vi.mocked(bufferToBase64).mockReset()
  vi.mocked(keyStore.setIdentityKeys).mockReset()
  vi.mocked(keyStore.clear).mockReset()
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

  it('login with CHAT permission and existing keys decrypts and stores them', async () => {
    const mockPrivateKey = { type: 'private' } as unknown as CryptoKey
    const mockPublicKey = { type: 'public' } as unknown as CryptoKey
    const mockWrappingKey = { type: 'wrapping' } as unknown as CryptoKey
    const mockSaltBuffer = new Uint8Array([1, 2, 3, 4])

    vi.mocked(fetchUserKeys).mockResolvedValue({
      publicKey: JSON.stringify({ kty: 'EC', crv: 'P-256' }),
      encryptedPrivateKey: 'encrypted-privkey-base64',
      pbkdf2Salt: 'c2FsdA==',
      pbkdf2Iterations: 600000,
    })
    vi.mocked(base64ToBuffer).mockReturnValue(mockSaltBuffer)
    vi.mocked(deriveWrappingKey).mockResolvedValue(mockWrappingKey)
    vi.mocked(decryptPrivateKey).mockResolvedValue(mockPrivateKey)
    vi.mocked(importPublicKey).mockResolvedValue(mockPublicKey)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        email: 'user@test.com',
        permissions: ['CHAT'],
        groups: ['Users'],
      }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(fetchUserKeys).toHaveBeenCalled()
    expect(base64ToBuffer).toHaveBeenCalledWith('c2FsdA==')
    expect(deriveWrappingKey).toHaveBeenCalledWith('password123', mockSaltBuffer.buffer, 600000)
    expect(decryptPrivateKey).toHaveBeenCalledWith('encrypted-privkey-base64', mockWrappingKey)
    expect(importPublicKey).toHaveBeenCalledWith({ kty: 'EC', crv: 'P-256' })
    expect(keyStore.setIdentityKeys).toHaveBeenCalledWith(mockPrivateKey, mockPublicKey)
    expect(uploadUserKeys).not.toHaveBeenCalled()
  })

  it('login with CHAT permission and no existing keys generates and uploads them', async () => {
    const mockPrivateKey = { type: 'private' } as unknown as CryptoKey
    const mockPublicKey = { type: 'public' } as unknown as CryptoKey
    const mockWrappingKey = { type: 'wrapping' } as unknown as CryptoKey
    const mockSalt = new Uint8Array([5, 6, 7, 8])
    const mockPublicKeyJwk = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' }

    vi.mocked(fetchUserKeys).mockResolvedValue(null)
    vi.mocked(generateIdentityKeyPair).mockResolvedValue({
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey,
    } as CryptoKeyPair)
    vi.mocked(generateSalt).mockReturnValue(mockSalt)
    vi.mocked(deriveWrappingKey).mockResolvedValue(mockWrappingKey)
    vi.mocked(encryptPrivateKey).mockResolvedValue('new-encrypted-privkey')
    vi.mocked(exportPublicKey).mockResolvedValue(mockPublicKeyJwk)
    vi.mocked(bufferToBase64).mockReturnValue('BQYHCA==')
    vi.mocked(uploadUserKeys).mockResolvedValue(undefined)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        email: 'user@test.com',
        permissions: ['CHAT'],
        groups: ['Users'],
      }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(fetchUserKeys).toHaveBeenCalled()
    expect(generateIdentityKeyPair).toHaveBeenCalled()
    expect(generateSalt).toHaveBeenCalled()
    expect(deriveWrappingKey).toHaveBeenCalledWith('password123', mockSalt.buffer, 600000)
    expect(encryptPrivateKey).toHaveBeenCalledWith(mockPrivateKey, mockWrappingKey)
    expect(exportPublicKey).toHaveBeenCalledWith(mockPublicKey)
    expect(uploadUserKeys).toHaveBeenCalledWith({
      publicKey: JSON.stringify(mockPublicKeyJwk),
      encryptedPrivateKey: 'new-encrypted-privkey',
      pbkdf2Salt: 'BQYHCA==',
      pbkdf2Iterations: 600000,
    })
    expect(keyStore.setIdentityKeys).toHaveBeenCalledWith(mockPrivateKey, mockPublicKey)
  })

  it('login without CHAT permission does not set up E2E keys', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        email: 'user@test.com',
        permissions: ['METRICS'],
        groups: ['Users'],
      }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(fetchUserKeys).not.toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login continues successfully when E2E key setup fails', async () => {
    vi.mocked(fetchUserKeys).mockRejectedValue(new Error('Network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        email: 'user@test.com',
        permissions: ['CHAT'],
        groups: ['Users'],
      }),
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login('user@test.com', 'password123')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.email).toBe('user@test.com')
    expect(warnSpy).toHaveBeenCalledWith('E2E key setup failed:', expect.any(Error))
    warnSpy.mockRestore()
  })

  it('logout clears keyStore', async () => {
    localStorage.setItem('email', 'user@test.com')
    mockFetch.mockResolvedValueOnce({ ok: true })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      result.current.logout()
    })

    expect(keyStore.clear).toHaveBeenCalled()
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
