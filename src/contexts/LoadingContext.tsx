// Context + hook only. The provider lives in LoadingProvider.tsx so that this file exports no
// component: Fast Refresh only preserves state for modules that export components exclusively.
import { createContext, useContext } from 'react';

export interface LoadingContextType {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const LoadingContext = createContext<LoadingContextType>({
  loading: false,
  setLoading: () => {},
  withLoading: async (fn) => fn(),
});

export function useLoading() {
  return useContext(LoadingContext);
}
