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

test.describe('Navigation', () => {
  test('can navigate to page details', async ({ page }) => {
    await page.goto('/');

    // If there are monitored pages, click on one
    const pageCard = page.locator('[data-testid="page-card"]').first();

    if (await pageCard.isVisible()) {
      await pageCard.click();

      // Should navigate to detail page
      await expect(page.url()).toContain('/pages/');

      // Should show value chart
      await expect(page.locator('canvas, svg')).toBeVisible();
    }
  });
});
