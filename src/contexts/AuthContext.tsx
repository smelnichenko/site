// Context + hook only. The provider lives in AuthProvider.tsx so that this file exports no
// component: Fast Refresh only preserves state for modules that export components exclusively.
import { createContext, useContext } from 'react';
import type { UserInfo } from '../services/oidcClient';

export interface AuthState {
  email: string | null;
  uuid: string | null;
  permissions: string[];
}

export interface AuthContextType extends AuthState {
  handleCallback: (code: string) => Promise<void>;
  logout: () => void;
  refreshPermissions: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  getAccessToken: () => Promise<string | null>;
  initializing: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function userInfoToState(info: UserInfo): AuthState {
  return {
    email: info.email,
    uuid: info.uuid,
    permissions: info.permissions,
  };
}

export const EMPTY_STATE: AuthState = { email: null, uuid: null, permissions: [] };

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
