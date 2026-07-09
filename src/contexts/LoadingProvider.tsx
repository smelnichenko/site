import React, { useCallback, useMemo, useState } from 'react';
import { LoadingContext } from './LoadingContext';

export function LoadingProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [loading, setLoading] = useState(false);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      loading,
      setLoading,
      withLoading,
    }),
    [loading, withLoading],
  );

  return <LoadingContext.Provider value={contextValue}>{children}</LoadingContext.Provider>;
}
