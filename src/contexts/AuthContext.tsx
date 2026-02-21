import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthState {
  username: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const username = localStorage.getItem('username');
    return { username };
  });

  const isAuthenticated = !!auth.username;

  useEffect(() => {
    if (auth.username) {
      localStorage.setItem('username', auth.username);
    } else {
      localStorage.removeItem('username');
    }
  }, [auth]);

  // Session validation: periodically check if the cookie/token is still valid
  useEffect(() => {
    if (!auth.username) return;

    const checkSession = async () => {
      try {
        const response = await fetch('/api/monitor/pages', { credentials: 'include' });
        if (response.status === 401) {
          localStorage.removeItem('username');
          setAuth({ username: null });
        }
      } catch {
        // Network error — don't log out
      }
    };

    const interval = setInterval(checkSession, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [auth.username]);

  async function login(username: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    const data = await response.json();
    setAuth({ username: data.username });
  }

  async function register(username: string, password: string, email: string) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, email }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Registration failed');
    }
    const data = await response.json();
    setAuth({ username: data.username });
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
    localStorage.removeItem('username');
    setAuth({ username: null });
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, register, logout, isAuthenticated }}>
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
