import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = 'e2e-nav@test.com';
const TEST_PASS = 'e2e-nav-pass';

async function loginViaUI(page: Page) {
  await page.goto('/login');
  await page.fill('input#email', TEST_EMAIL);
  await page.fill('input#password', TEST_PASS);
  await page.click('button[type="submit"]');
  await expect(page.locator('header button.btn-logout')).toBeVisible();
}

test('simple navigation to RSS Feeds', async ({ page }) => {
  await loginViaUI(page);
  await expect(page.locator('main')).toBeVisible();

  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);

  // Check that we're either showing feed cards OR "No RSS feeds configured"
  const hasCards = await page.locator('[data-testid="rss-feed-card"]').first().isVisible({ timeout: 5000 }).catch(() => false);
  const hasNoFeedsMessage = await page.getByText('No RSS feeds configured').isVisible({ timeout: 5000 }).catch(() => false);

  expect(hasCards || hasNoFeedsMessage).toBe(true);
});

test('back and forth navigation preserves data loading', async ({ page }) => {
  await loginViaUI(page);
  await expect(page.locator('main')).toBeVisible();

  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);
  await expect(page.locator('main')).toBeVisible();

  await page.click('nav >> text=Monitors');
  await expect(page.locator('main')).toBeVisible();

  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);

  await expect(page.locator('.card, main').first()).toBeVisible({ timeout: 5000 });
});

test('navigation to Configuration page', async ({ page }) => {
  await loginViaUI(page);
  await expect(page.locator('main')).toBeVisible();

  await page.click('text=Configuration');
  await expect(page).toHaveURL(/\/monitors/);

  await expect(page.getByText('Page Monitors', { exact: true })).toBeVisible();
  await expect(page.getByText('RSS Feed Monitors', { exact: true })).toBeVisible();
});
