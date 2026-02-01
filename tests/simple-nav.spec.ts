import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test('simple navigation to RSS Feeds', async ({ page }) => {
  // Start on Dashboard
  await page.goto(BASE_URL);

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Navigate to RSS Feeds
  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);

  // Wait for network to settle
  await page.waitForLoadState('networkidle');

  // Check that we're either showing feed cards OR "No RSS feeds configured"
  const hasCards = await page.locator('[data-testid="rss-feed-card"]').first().isVisible();
  const hasNoFeedsMessage = await page.getByText('No RSS feeds configured').isVisible();

  expect(hasCards || hasNoFeedsMessage).toBe(true);
});

test('back and forth navigation preserves data loading', async ({ page }) => {
  // Start on Dashboard
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // Navigate to RSS
  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);
  await page.waitForLoadState('networkidle');

  // Navigate back to Pages
  await page.click('text=Pages');
  await expect(page).toHaveURL(/^(?!.*\/rss)/);
  await page.waitForLoadState('networkidle');

  // Navigate to RSS again
  await page.click('text=RSS Feeds');
  await expect(page).toHaveURL(/\/rss/);
  await page.waitForLoadState('networkidle');

  // Verify that we can still see RSS content
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
});
