import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoading } from './LoadingContext';
import { LoadingProvider } from './LoadingProvider';

function wrapper({ children }: { children: React.ReactNode }) {
  return <LoadingProvider>{children}</LoadingProvider>;
}

describe('LoadingContext', () => {
  it('initial state is not loading', () => {
    const { result } = renderHook(() => useLoading(), { wrapper });
    expect(result.current.loading).toBe(false);
  });

  it('setLoading updates loading state', () => {
    const { result } = renderHook(() => useLoading(), { wrapper });
    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.loading).toBe(false);
  });

  it('withLoading runs the operation once and ends with loading false', async () => {
    const { result } = renderHook(() => useLoading(), { wrapper });
    let runs = 0;

    await act(async () => {
      await result.current.withLoading(() => {
        runs += 1;
        return Promise.resolve('done');
      });
    });
    expect(runs).toBe(1);

    // After withLoading completes, loading should be false
    expect(result.current.loading).toBe(false);
  });

  it('withLoading resets loading on error', async () => {
    const { result } = renderHook(() => useLoading(), { wrapper });

    await expect(
      act(async () => {
        await result.current.withLoading(() => Promise.reject(new Error('test error')));
      }),
    ).rejects.toThrow('test error');

    expect(result.current.loading).toBe(false);
  });
});
