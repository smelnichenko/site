import { test, expect, Page, APIRequestContext } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@test.com';
const TEST_PASS = 'e2e-test-pass';

async function getAuthToken(request: APIRequestContext): Promise<string> {
  // Try register first, then login if user exists
  let response = await request.post('/api/auth/register', {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (!response.ok()) {
    response = await request.post('/api/auth/login', {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
  }
  const body = await response.json();
  return body.token;
}

async function loginViaUI(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('/login');
    await page.fill('input#email', TEST_EMAIL);
    await page.fill('input#password', TEST_PASS);
    await page.click('button[type="submit"]');
    try {
      await expect(page.locator('button:has-text("Logout")')).toBeVisible({ timeout: 10000 });
      return;
    } catch {
      // Rate limited or slow — wait and retry
      await page.waitForTimeout(2000);
    }
  }
  throw new Error('Login failed after 3 attempts');
}

test.describe('Smoke Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request);
  });

  test('homepage redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h2')).toContainText('Login');
  });

  test('can login via UI', async ({ page, request }) => {
    await getAuthToken(request); // ensure user exists
    await loginViaUI(page);
    await expect(page.locator('main')).toBeVisible();
  });

  test('dashboard displays after login', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('API health endpoint is accessible without auth', async ({ request }) => {
    const response = await request.get('/api/actuator/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('UP');
  });

  test('pages API endpoint responds with auth', async ({ request }) => {
    const response = await request.get('/api/monitor/pages', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('pages API endpoint rejects without auth', async ({ request }) => {
    const response = await request.get('/api/monitor/pages');
    expect(response.status()).toBe(401);
  });
});

test.describe('RSS Feed Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request);
  });

  test('RSS dashboard loads after login', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    // Navigate to RSS
    await page.click('text=RSS Feeds');
    await expect(page).toHaveURL(/\/rss/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('RSS feeds API endpoint responds with auth', async ({ request }) => {
    const response = await request.get('/api/rss/feeds', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('RSS config API endpoint responds with auth', async ({ request }) => {
    const response = await request.get('/api/rss/config', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});

test.describe('Navigation', () => {
  test('can navigate between Monitors, RSS Feeds, and Configuration', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    // Should see nav links with new names
    await expect(page.locator('a[href="/"]').filter({ hasText: 'Monitors' })).toBeVisible();
    await expect(page.locator('a[href="/rss"]')).toBeVisible();
    await expect(page.locator('a[href="/monitors"]').filter({ hasText: 'Configuration' })).toBeVisible();

    // Navigate to RSS
    await page.click('text=RSS Feeds');
    await expect(page).toHaveURL(/\/rss/);

    // Navigate to Configuration
    await page.click('text=Configuration');
    await expect(page).toHaveURL(/\/monitors/);

    // Navigate back to Monitors (dashboard)
    await page.click('nav >> text=Monitors');
    await expect(page).toHaveURL(/\/$/);
  });

  test('can navigate to page details if pages exist', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    const pageCard = page.locator('[data-testid="page-card"]').first();
    if (await pageCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pageCard.click();
      await expect(page).toHaveURL(/\/page\//);
    }
  });

  test('can navigate to RSS feed details if feeds exist', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    await page.click('text=RSS Feeds');
    await expect(page).toHaveURL(/\/rss/);

    const feedCard = page.locator('[data-testid="rss-feed-card"]').first();
    if (await feedCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await feedCard.click();
      await expect(page).toHaveURL(/\/rss\/.+/);
    }
  });
});

test.describe('Configuration Page', () => {
  test('configuration page loads and shows sections', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    await page.click('text=Configuration');
    await expect(page).toHaveURL(/\/monitors/);

    // Should see both sections
    await expect(page.getByText('Page Monitors', { exact: true })).toBeVisible();
    await expect(page.getByText('RSS Feed Monitors', { exact: true })).toBeVisible();
  });

  test('can open add page monitor form', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    await page.click('text=Configuration');
    await page.click('text=+ Add Page Monitor');

    // Should see form fields
    await expect(page.locator('.config-form')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Test")')).toBeVisible();
  });

  test('can open add RSS feed form', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    await page.click('text=Configuration');
    await page.click('text=+ Add RSS Feed');

    await expect(page.locator('.config-form')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
    await expect(page.locator('button:has-text("Test")')).toBeVisible();
  });

  test('cancel closes the form', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    await page.click('text=Configuration');
    await page.click('text=+ Add Page Monitor');
    await expect(page.locator('.config-form')).toBeVisible();

    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.config-form')).not.toBeVisible();
  });
});

test.describe('Auth Flow', () => {
  test('logout redirects to login', async ({ page, request }) => {
    await getAuthToken(request);
    await loginViaUI(page);

    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/login/);
  });

  test('register page loads and has link to login', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h2')).toContainText('Register');
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });
});

test.describe('Rate Limiting', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request);
  });

  test('API returns rate limit headers', async ({ request }) => {
    const response = await request.get('/api/monitor/pages', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const headers = response.headers();
    expect(headers['x-ratelimit-limit']).toBeDefined();
    expect(headers['x-ratelimit-remaining']).toBeDefined();
  });

  test('health endpoint bypasses rate limiting', async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      const response = await request.get('/api/actuator/health');
      expect(response.ok()).toBeTruthy();
    }
  });
});
