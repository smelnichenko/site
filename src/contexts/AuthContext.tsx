import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setPermissionsChangedCallback } from '../services/api';

interface AuthState {
  email: string | null;
  permissions: string[];
  groups: string[];
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = '/api';

function loadState(): AuthState {
  const email = localStorage.getItem('email');
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
  const groups = JSON.parse(localStorage.getItem('groups') || '[]');
  return { email, permissions, groups };
}

function saveState(state: AuthState) {
  if (state.email) {
    localStorage.setItem('email', state.email);
    localStorage.setItem('permissions', JSON.stringify(state.permissions));
    localStorage.setItem('groups', JSON.stringify(state.groups));
  } else {
    localStorage.removeItem('email');
    localStorage.removeItem('permissions');
    localStorage.removeItem('groups');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadState);

  const isAuthenticated = !!auth.email;

  const hasPermission = useCallback(
    (permission: string) => auth.permissions.includes(permission),
    [auth.permissions]
  );

  useEffect(() => {
    saveState(auth);
  }, [auth]);

  // Register global callback for permission refresh (called by apiFetch on 403 permissions_changed)
  const refreshPermissions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        // Refresh failed — force re-login
        setAuth({ email: null, permissions: [], groups: [] });
        return;
      }
      const data = await response.json();
      setAuth(prev => ({
        ...prev,
        permissions: data.permissions || [],
        groups: data.groups || [],
      }));
    } catch {
      // Network error — don't log out
    }
  }, []);

  useEffect(() => {
    if (auth.email) {
      setPermissionsChangedCallback(refreshPermissions);
    } else {
      setPermissionsChangedCallback(null);
    }
    return () => setPermissionsChangedCallback(null);
  }, [auth.email, refreshPermissions]);

  // Session validation: periodically check if the cookie/token is still valid
  useEffect(() => {
    if (!auth.email) return;

    const checkSession = async () => {
      try {
        const response = await fetch('/api/user/last-path', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: '/' }),
        });
        if (response.status === 401) {
          setAuth({ email: null, permissions: [], groups: [] });
        }
      } catch {
        // Network error — don't log out
      }
    };

    const interval = setInterval(checkSession, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [auth.email]);

  async function login(email: string, password: string): Promise<string | null> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    const data = await response.json();
    setAuth({
      email: data.email,
      permissions: data.permissions || [],
      groups: data.groups || [],
    });
    return data.lastPath ?? null;
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors during logout
    }
    setAuth({ email: null, permissions: [], groups: [] });
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated, hasPermission }}>
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
