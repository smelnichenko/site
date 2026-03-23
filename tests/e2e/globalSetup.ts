/**
 * Playwright global setup for E2E tests.
 *
 * With Keycloak auth, user provisioning and login happen through
 * the Keycloak OIDC flow, not via direct API calls. E2E tests
 * should authenticate through the Keycloak login page or use
 * Keycloak's direct grant (resource owner password) for test users.
 *
 * TODO: implement Keycloak-based E2E test user bootstrap
 */

export default async function globalSetup() {
  console.log('[globalSetup] Keycloak E2E auth setup not yet implemented');
}
