import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface LoadingContextType {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType>({
  loading: false,
  setLoading: () => {},
  withLoading: async (fn) => fn(),
});

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

  const contextValue = useMemo(() => ({
    loading, setLoading, withLoading,
  }), [loading, withLoading]);

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}
