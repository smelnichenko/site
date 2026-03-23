import { OIDC_CONFIG } from '../config/oidc';

// Module-scoped token storage (memory only — most secure for SPA)
let accessToken: string | null = null;
let refreshToken: string | null = null;
let expiresAt: number = 0;
let refreshTimer: number | null = null;

export interface UserInfo {
  email: string;
  uuid: string;
  permissions: string[];
}

// Keycloak default roles to filter out
const KEYCLOAK_DEFAULT_ROLES = [
  'default-roles-schnappy',
  'offline_access',
  'uma_authorization',
  'Users',
  'Admins',
];

// PKCE helpers using Web Crypto API

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeVerifier(): Promise<string> {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return base64urlEncode(buffer.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(hash);
}

// Parse JWT payload (no validation — gateway validates)
function parseJwt(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

function extractUserInfo(token: string): UserInfo {
  const claims = parseJwt(token);
  const realmAccess = claims.realm_access as { roles?: string[] } | undefined;
  const roles = (realmAccess?.roles || []).filter(
    (r: string) => !KEYCLOAK_DEFAULT_ROLES.includes(r)
  );
  return {
    email: claims.email as string,
    uuid: claims.sub as string,
    permissions: roles,
  };
}

function scheduleRefresh(): void {
  cancelRefresh();
  const now = Date.now();
  // Refresh 60 seconds before expiry, minimum 5 seconds from now
  const delay = Math.max((expiresAt - now) - 60_000, 5_000);
  refreshTimer = globalThis.setTimeout(() => {
    void silentRefresh();
  }, delay) as unknown as number;
}

function cancelRefresh(): void {
  if (refreshTimer !== null) {
    globalThis.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

async function tokenRequest(params: URLSearchParams): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const response = await fetch(
    `${OIDC_CONFIG.authority}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );
  if (!response.ok) {
    const error = await response.text().catch(() => 'Token request failed');
    throw new Error(error);
  }
  return response.json();
}

async function silentRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: OIDC_CONFIG.clientId,
      refresh_token: refreshToken,
    });
    const data = await tokenRequest(params);
    accessToken = data.access_token;
    if (data.refresh_token) {
      refreshToken = data.refresh_token;
    }
    expiresAt = Date.now() + data.expires_in * 1000;
    scheduleRefresh();
    return true;
  } catch {
    // Refresh failed — tokens are stale
    accessToken = null;
    refreshToken = null;
    expiresAt = 0;
    return false;
  }
}

// Public API

export async function login(): Promise<void> {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem('oidc_code_verifier', verifier);

  const params = new URLSearchParams({
    client_id: OIDC_CONFIG.clientId,
    redirect_uri: OIDC_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  globalThis.location.href = `${OIDC_CONFIG.authority}/protocol/openid-connect/auth?${params}`;
}

export async function handleCallback(code: string): Promise<UserInfo> {
  const codeVerifier = sessionStorage.getItem('oidc_code_verifier');
  sessionStorage.removeItem('oidc_code_verifier');
  if (!codeVerifier) {
    throw new Error('Missing PKCE code verifier');
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: OIDC_CONFIG.clientId,
    code,
    redirect_uri: OIDC_CONFIG.redirectUri,
    code_verifier: codeVerifier,
  });

  const data = await tokenRequest(params);
  accessToken = data.access_token;
  refreshToken = data.refresh_token ?? null;
  expiresAt = Date.now() + data.expires_in * 1000;
  scheduleRefresh();
  return extractUserInfo(accessToken);
}

export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < expiresAt) {
    return accessToken;
  }
  // Token expired — try refresh
  const refreshed = await silentRefresh();
  return refreshed ? accessToken : null;
}

export function logout(): void {
  accessToken = null;
  refreshToken = null;
  expiresAt = 0;
  cancelRefresh();

  const logoutUrl = `${OIDC_CONFIG.authority}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(OIDC_CONFIG.postLogoutRedirectUri)}&client_id=${OIDC_CONFIG.clientId}`;
  globalThis.location.href = logoutUrl;
}

export function isAuthenticated(): boolean {
  return accessToken !== null && Date.now() < expiresAt;
}

/**
 * Force-refresh the token and return updated user info.
 * Used after approval/role changes to pick up new Keycloak roles.
 */
export async function refreshAndGetUserInfo(): Promise<UserInfo | null> {
  const refreshed = await silentRefresh();
  if (refreshed && accessToken) {
    return extractUserInfo(accessToken);
  }
  return null;
}

/**
 * Try to restore session from in-memory tokens.
 * If refresh token exists, refresh and return user info.
 * On page refresh (tokens lost), returns null — user redirects to Keycloak
 * which auto-authenticates via session cookie (instant, no login prompt).
 */
export async function trySilentAuth(): Promise<UserInfo | null> {
  if (refreshToken) {
    const refreshed = await silentRefresh();
    if (refreshed && accessToken) {
      return extractUserInfo(accessToken);
    }
  }
  if (accessToken && Date.now() < expiresAt) {
    return extractUserInfo(accessToken);
  }
  return null;
}
