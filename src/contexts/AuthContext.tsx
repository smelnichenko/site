import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { setPermissionsChangedCallback, fetchUserKeys, uploadUserKeys } from '../services/api';
import {
  generateIdentityKeyPair,
  exportPublicKey,
  importPublicKey,
  generateSalt,
  deriveWrappingKey,
  encryptPrivateKey,
  decryptPrivateKey,
  bufferToBase64,
  base64ToBuffer,
} from '../services/crypto';
import * as keyStore from '../services/keyStore';

interface AuthState {
  email: string | null;
  userId: number | null;
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
  const userId = localStorage.getItem('userId');
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
  const groups = JSON.parse(localStorage.getItem('groups') || '[]');
  return { email, userId: userId ? Number.parseInt(userId, 10) : null, permissions, groups };
}

function saveState(state: AuthState) {
  if (state.email) {
    localStorage.setItem('email', state.email);
    if (state.userId) localStorage.setItem('userId', String(state.userId));
    localStorage.setItem('permissions', JSON.stringify(state.permissions));
    localStorage.setItem('groups', JSON.stringify(state.groups));
  } else {
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
    localStorage.removeItem('permissions');
    localStorage.removeItem('groups');
  }
}

async function setupE2eKeys(password: string) {
  const existing = await fetchUserKeys();
  if (existing) {
    // Decrypt existing private key
    const salt = base64ToBuffer(existing.pbkdf2Salt);
    const wrappingKey = await deriveWrappingKey(password, salt.buffer as ArrayBuffer, existing.pbkdf2Iterations);
    const privateKey = await decryptPrivateKey(existing.encryptedPrivateKey, wrappingKey);
    const publicKey = await importPublicKey(JSON.parse(existing.publicKey));
    keyStore.setIdentityKeys(privateKey, publicKey);
  } else {
    // Generate new key pair
    const keyPair = await generateIdentityKeyPair();
    const salt = generateSalt();
    const wrappingKey = await deriveWrappingKey(password, salt.buffer as ArrayBuffer, 600000);
    const encryptedPrivKey = await encryptPrivateKey(keyPair.privateKey, wrappingKey);
    const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

    await uploadUserKeys({
      publicKey: JSON.stringify(publicKeyJwk),
      encryptedPrivateKey: encryptedPrivKey,
      pbkdf2Salt: bufferToBase64(salt),
      pbkdf2Iterations: 600000,
    });
    keyStore.setIdentityKeys(keyPair.privateKey, keyPair.publicKey);
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
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
        setAuth({ email: null, userId: null, permissions: [], groups: [] });
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
          setAuth({ email: null, userId: null, permissions: [], groups: [] });
        }
      } catch {
        // Network error — don't log out
      }
    };

    const interval = setInterval(checkSession, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [auth.email]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
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
      userId: data.userId ?? null,
      permissions: data.permissions || [],
      groups: data.groups || [],
    });

    // Set up E2E encryption keys (best-effort, don't block login)
    if (data.permissions?.includes('CHAT')) {
      try {
        await setupE2eKeys(password);
      } catch (e) {
        console.warn('E2E key setup failed:', e);
      }
    }

    return data.lastPath ?? null;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors during logout
    }
    keyStore.clear();
    setAuth({ email: null, userId: null, permissions: [], groups: [] });
  }, []);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  const contextValue = useMemo(() => ({
    ...auth, login, logout: handleLogout, isAuthenticated, hasPermission,
  }), [auth, login, handleLogout, isAuthenticated, hasPermission]);

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
