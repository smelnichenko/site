import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import * as oidcClient from '../services/oidcClient';
import type { UserInfo } from '../services/oidcClient';
import * as keyStore from '../services/keyStore';

interface AuthState {
  email: string | null;
  uuid: string | null;
  userId: number | null;
  permissions: string[];
}

interface AuthContextType extends AuthState {
  handleCallback: (code: string) => Promise<void>;
  logout: () => void;
  refreshPermissions: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  getAccessToken: () => Promise<string | null>;
  initializing: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function userInfoToState(info: UserInfo): AuthState {
  return {
    email: info.email,
    uuid: info.uuid,
    userId: null, // Numeric ID not available from Keycloak token — populated by backend if needed
    permissions: info.permissions,
  };
}

const EMPTY_STATE: AuthState = { email: null, uuid: null, userId: null, permissions: [] };

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [auth, setAuth] = useState<AuthState>(EMPTY_STATE);
  const [initializing, setInitializing] = useState(true);

  const isAuthenticated = !!auth.email;

  const hasPermission = useCallback(
    (permission: string) => auth.permissions.includes(permission),
    [auth.permissions]
  );

  // On mount: check if we have tokens in memory (e.g., after token refresh)
  useEffect(() => {
    // Skip silent auth if we're on the callback page (handleCallback will set auth)
    if (globalThis.location.pathname === '/auth/callback') {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    (async () => {
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
    return () => { cancelled = true; };
  }, []);

  const handleCallback = useCallback(async (code: string): Promise<void> => {
    const userInfo = await oidcClient.handleCallback(code);
    setAuth(userInfoToState(userInfo));
    setInitializing(false);
  }, []);

  const logout = useCallback(() => {

    keyStore.clear();
    setAuth(EMPTY_STATE);
    oidcClient.logout();
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

  const contextValue = useMemo(() => ({
    ...auth,
    handleCallback,
    logout,
    refreshPermissions,
    isAuthenticated,
    hasPermission,
    getAccessToken,
    initializing,
  }), [auth, handleCallback, logout, refreshPermissions, isAuthenticated, hasPermission, getAccessToken, initializing]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
