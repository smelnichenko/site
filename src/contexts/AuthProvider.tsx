import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import * as oidcClient from '../services/oidcClient';
import * as keyStore from '../services/keyStore';
import { AuthContext, EMPTY_STATE, userInfoToState, type AuthState } from './AuthContext';

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [auth, setAuth] = useState<AuthState>(EMPTY_STATE);
  // On the callback page silent auth is skipped (handleCallback sets auth), so
  // there is nothing to initialize — derive the initial flag instead of setting
  // it synchronously inside the effect.
  const [initializing, setInitializing] = useState(
    () => globalThis.location.pathname !== '/auth/callback',
  );

  const isAuthenticated = !!auth.email;

  const hasPermission = useCallback(
    (permission: string) => auth.permissions.includes(permission),
    [auth.permissions],
  );

  // On mount: check if we have tokens in memory (e.g., after token refresh)
  useEffect(() => {
    // Skip silent auth if we're on the callback page (handleCallback will set
    // auth). `initializing` already starts false for that path (see useState).
    if (globalThis.location.pathname === '/auth/callback') {
      return;
    }
    let cancelled = false;
    // Rejections are handled by the try/catch/finally below, so this
    // fire-and-forget async work is intentionally not awaited.
    void (async () => {
      try {
        const userInfo = await oidcClient.trySilentAuth();
        if (!cancelled && userInfo) {
          setAuth(userInfoToState(userInfo));
        }
      } catch {
        // No session — stay logged out
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCallback = useCallback(async (code: string): Promise<void> => {
    const userInfo = await oidcClient.handleCallback(code);
    setAuth(userInfoToState(userInfo));
    setInitializing(false);
  }, []);

  const logout = useCallback(() => {
    keyStore.clear();
    oidcClient.logout(); // Redirects to Keycloak — must happen before setAuth triggers re-render
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return oidcClient.getAccessToken();
  }, []);

  // Refresh Keycloak token to pick up updated roles/permissions
  const refreshPermissions = useCallback(async (): Promise<void> => {
    try {
      const userInfo = await oidcClient.refreshAndGetUserInfo();
      if (userInfo) {
        setAuth(userInfoToState(userInfo));
      }
    } catch {
      // Refresh failed — don't log out
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      ...auth,
      handleCallback,
      logout,
      refreshPermissions,
      isAuthenticated,
      hasPermission,
      getAccessToken,
      initializing,
    }),
    [
      auth,
      handleCallback,
      logout,
      refreshPermissions,
      isAuthenticated,
      hasPermission,
      getAccessToken,
      initializing,
    ],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
