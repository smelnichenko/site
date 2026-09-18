/**
 * Playwright global setup for E2E tests.
 *
 * With Keycloak auth, user provisioning and login happen through
 * the Keycloak OIDC flow, not via direct API calls. E2E tests
 * should authenticate through the Keycloak login page or use
 * Keycloak's direct grant (resource owner password) for test users.
 *
 * Not implemented: a Keycloak direct-grant bootstrap of test users. Until it exists the suite signs in through the UI.
 */

export default function globalSetup() {
  console.log('[globalSetup] Keycloak E2E auth setup not yet implemented');
}
