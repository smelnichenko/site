export const OIDC_CONFIG = {
  authority: 'https://auth.pmon.dev/realms/schnappy',
  clientId: 'app',
  redirectUri: `${globalThis.location.origin}/auth/callback`,
  postLogoutRedirectUri: globalThis.location.origin,
};
