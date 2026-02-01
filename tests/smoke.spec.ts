import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/Monitor/);

    // Check main heading is visible
    await expect(page.locator('h1')).toBeVisible();
  });

  test('dashboard displays monitored pages', async ({ page }) => {
    await page.goto('/');

    // Wait for the page list to load (or empty state)
    await expect(page.locator('body')).toBeVisible();

    // Check that dashboard content is rendered
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('API health endpoint is accessible', async ({ request }) => {
    const response = await request.get('/api/actuator/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('UP');
  });

  test('pages API endpoint responds', async ({ request }) => {
    const response = await request.get('/api/monitor/pages');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});

test.describe('RSS Feed Tests', () => {
  test('RSS dashboard loads successfully', async ({ page }) => {
    await page.goto('/rss');

    // Check main heading is visible
    await expect(page.locator('h1')).toBeVisible();

    // Check navigation link to RSS is present
    await expect(page.locator('a[href="/rss"]')).toBeVisible();
  });

  test('RSS feeds API endpoint responds', async ({ request }) => {
    const response = await request.get('/api/rss/feeds');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('RSS config API endpoint responds', async ({ request }) => {
    const response = await request.get('/api/rss/config');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('RSS chart data API returns object', async ({ request }) => {
    // Use a known feed name or fallback to generic test
    const feedsResponse = await request.get('/api/rss/feeds');
    const feeds = await feedsResponse.json();

    if (feeds.length > 0) {
      const response = await request.get(`/api/rss/results/${feeds[0]}/chart-data`);
      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(typeof body).toBe('object');
    }
  });
});

test.describe('Navigation', () => {
  test('can navigate to page details', async ({ page }) => {
    await page.goto('/');

    // If there are monitored pages, click on one
    const pageCard = page.locator('[data-testid="page-card"]').first();

    if (await pageCard.isVisible()) {
      await pageCard.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/page\//);

      // Should show value chart
      await expect(page.locator('canvas, svg')).toBeVisible();
    }
  });

  test('can navigate between dashboard and RSS', async ({ page }) => {
    await page.goto('/');

    // Click RSS link in navigation
    const rssLink = page.locator('a[href="/rss"]');
    if (await rssLink.isVisible()) {
      await rssLink.click();
      await expect(page).toHaveURL(/\/rss/);
    }

    // Navigate back to main dashboard
    const dashboardLink = page.locator('a[href="/"]').first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForURL(/^(?!.*\/rss)/);
    }
  });

  test('can navigate to RSS feed details', async ({ page }) => {
    await page.goto('/rss');

    // If there are RSS feeds, click on one
    const feedCard = page.locator('[data-testid="rss-feed-card"]').first();

    if (await feedCard.isVisible()) {
      await feedCard.click();

      // Should navigate to RSS feed detail page
      await expect(page).toHaveURL(/\/rss\/.+/);
    }
  });
});

test.describe('Pagination', () => {
  test('page detail shows pagination when results exist', async ({ page, request }) => {
    // First check if there are pages with results
    const pagesResponse = await request.get('/api/monitor/pages');
    const pages = await pagesResponse.json();

    if (pages.length > 0) {
      await page.goto(`/page/${encodeURIComponent(pages[0])}`);

      // Wait for content to load
      await page.waitForSelector('.card');

      // Check for pagination or table
      const table = page.locator('table');
      await expect(table).toBeVisible();
    }
  });

  test('RSS feed detail shows pagination when results exist', async ({ page, request }) => {
    // First check if there are feeds with results
    const feedsResponse = await request.get('/api/rss/feeds');
    const feeds = await feedsResponse.json();

    if (feeds.length > 0) {
      await page.goto(`/rss/${encodeURIComponent(feeds[0])}`);

      // Wait for content to load
      await page.waitForSelector('.card');

      // Check for table
      const table = page.locator('table');
      await expect(table).toBeVisible();
    }
  });
});

test.describe('Rate Limiting', () => {
  test('API returns rate limit headers', async ({ request }) => {
    const response = await request.get('/api/monitor/pages');

    // Check rate limit headers are present
    const headers = response.headers();
    expect(headers['x-ratelimit-limit']).toBeDefined();
    expect(headers['x-ratelimit-remaining']).toBeDefined();
  });

  test('health endpoint bypasses rate limiting', async ({ request }) => {
    // Make multiple requests to health endpoint - should never be rate limited
    for (let i = 0; i < 10; i++) {
      const response = await request.get('/api/actuator/health');
      expect(response.ok()).toBeTruthy();
    }
  });
});
