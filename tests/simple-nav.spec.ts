import { test, expect, Page, APIRequestContext } from '@playwright/test';

const TEST_USER = 'e2e-nav-user';
const TEST_PASS = 'e2e-nav-pass';

async function ensureUser(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/auth/register', {
    data: { username: TEST_USER, password: TEST_PASS },
  });
  // Ignore if user already exists
}

async function loginViaUI(page: Page) {
  await page.goto('/login');
  await page.fill('input#username', TEST_USER);
  await page.fill('input#password', TEST_PASS);
  await page.click('button[type="submit"]');
  await expect(page.locator('button:has-text("Logout")')).toBeVisible();
}

test('simple navigation to RSS Feeds', async ({ page, request }) => {
  await ensureUser(request);
  await loginViaUI(page);

  await page.waitForLoadState('networkidle');

  // Navigate to RSS Feeds
  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);

  await page.waitForLoadState('networkidle');

  // Check that we're either showing feed cards OR "No RSS feeds configured"
  const hasCards = await page.locator('[data-testid="rss-feed-card"]').first().isVisible().catch(() => false);
  const hasNoFeedsMessage = await page.getByText('No RSS feeds configured').isVisible().catch(() => false);

  expect(hasCards || hasNoFeedsMessage).toBe(true);
});

test('back and forth navigation preserves data loading', async ({ page, request }) => {
  await ensureUser(request);
  await loginViaUI(page);
  await page.waitForLoadState('networkidle');

  // Navigate to RSS
  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);
  await page.waitForLoadState('networkidle');

  // Navigate back to Monitors (was "Pages")
  await page.click('nav >> text=Monitors');
  await page.waitForLoadState('networkidle');

  // Navigate to RSS again
  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);
  await page.waitForLoadState('networkidle');

  // Verify that we can still see content
  await expect(page.locator('.card, main').first()).toBeVisible({ timeout: 5000 });
});

test('navigation to Configuration page', async ({ page, request }) => {
  await ensureUser(request);
  await loginViaUI(page);
  await page.waitForLoadState('networkidle');

  // Navigate to Configuration
  await page.click('text=Configuration');
  await expect(page).toHaveURL(/\/monitors/);
  await page.waitForLoadState('networkidle');

  // Should see configuration sections
  await expect(page.getByText('Page Monitors', { exact: true })).toBeVisible();
  await expect(page.getByText('RSS Feed Monitors', { exact: true })).toBeVisible();
});
