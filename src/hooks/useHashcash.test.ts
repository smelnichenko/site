import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useHashcash } from './useHashcash'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn().mockImplementation(() => {
    setTimeout(() => {
      this.onmessage?.({ data: { nonce: '42', iterations: 43 } } as MessageEvent)
    }, 0)
  })
  terminate = vi.fn()
}

vi.stubGlobal('Worker', MockWorker)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('useHashcash', () => {
  it('fetches captcha config on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: true }),
    })

    renderHook(() => useHashcash())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/captcha/config')
    })
  })

  it('sets enabled=true when server returns enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: true }),
    })

    const { result } = renderHook(() => useHashcash())

    await waitFor(() => {
      expect(result.current.enabled).toBe(true)
    })
  })

  it('sets enabled=false when config fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useHashcash())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(result.current.enabled).toBe(false)
  })

  it('returns empty result when not enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: false }),
    })

    const { result } = renderHook(() => useHashcash())
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    let hashcashResult: { challenge: string; nonce: string }
    await act(async () => {
      hashcashResult = await result.current.solve()
    })
    expect(hashcashResult!).toEqual({ challenge: '', nonce: '' })
  })

  it('solves challenge via worker when enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: true }),
    })

    const { result } = renderHook(() => useHashcash())
    await waitFor(() => expect(result.current.enabled).toBe(true))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ challenge: 'test-challenge', difficulty: 16 }),
    })

    let hashcashResult: { challenge: string; nonce: string }
    await act(async () => {
      hashcashResult = await result.current.solve()
    })
    expect(hashcashResult!).toEqual({ challenge: 'test-challenge', nonce: '42' })
  })

  it('throws when challenge fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: true }),
    })

    const { result } = renderHook(() => useHashcash())
    await waitFor(() => expect(result.current.enabled).toBe(true))

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await act(async () => {
      await expect(result.current.solve()).rejects.toThrow('Failed to get captcha challenge')
    })
  })

  it('resets solving to false after solve completes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: true }),
    })

    const { result } = renderHook(() => useHashcash())
    await waitFor(() => expect(result.current.enabled).toBe(true))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ challenge: 'c', difficulty: 1 }),
    })

    await act(async () => {
      await result.current.solve()
    })
    expect(result.current.solving).toBe(false)
  })
})
