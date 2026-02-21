import React, { createContext, useContext, useState, useCallback } from 'react';

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

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <LoadingContext.Provider value={{ loading, setLoading, withLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}
