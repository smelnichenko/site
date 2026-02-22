import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthState {
  email: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const email = localStorage.getItem('email');
    return { email };
  });

  const isAuthenticated = !!auth.email;

  useEffect(() => {
    if (auth.email) {
      localStorage.setItem('email', auth.email);
    } else {
      localStorage.removeItem('email');
    }
  }, [auth]);

  // Session validation: periodically check if the cookie/token is still valid
  useEffect(() => {
    if (!auth.email) return;

    const checkSession = async () => {
      try {
        const response = await fetch('/api/monitor/pages', { credentials: 'include' });
        if (response.status === 401) {
          localStorage.removeItem('email');
          setAuth({ email: null });
        }
      } catch {
        // Network error — don't log out
      }
    };

    const interval = setInterval(checkSession, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [auth.email]);

  async function login(email: string, password: string) {
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
    setAuth({ email: data.email });
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
    localStorage.removeItem('email');
    setAuth({ email: null });
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated }}>
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
