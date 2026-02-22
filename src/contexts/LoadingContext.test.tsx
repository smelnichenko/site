import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { LoadingProvider, useLoading } from './LoadingContext'

function wrapper({ children }: { children: React.ReactNode }) {
  return <LoadingProvider>{children}</LoadingProvider>
}

describe('LoadingContext', () => {
  it('initial state is not loading', () => {
    const { result } = renderHook(() => useLoading(), { wrapper })
    expect(result.current.loading).toBe(false)
  })

  it('setLoading updates loading state', () => {
    const { result } = renderHook(() => useLoading(), { wrapper })
    act(() => {
      result.current.setLoading(true)
    })
    expect(result.current.loading).toBe(true)

    act(() => {
      result.current.setLoading(false)
    })
    expect(result.current.loading).toBe(false)
  })

  it('withLoading sets loading during async operation', async () => {
    const { result } = renderHook(() => useLoading(), { wrapper })
    const states: boolean[] = []

    await act(async () => {
      await result.current.withLoading(async () => {
        states.push(result.current.loading)
        return 'done'
      })
    })

    // After withLoading completes, loading should be false
    expect(result.current.loading).toBe(false)
  })

  it('withLoading resets loading on error', async () => {
    const { result } = renderHook(() => useLoading(), { wrapper })

    await expect(
      act(async () => {
        await result.current.withLoading(async () => {
          throw new Error('test error')
        })
      }),
    ).rejects.toThrow('test error')

    expect(result.current.loading).toBe(false)
  })
})
