import { expect, test } from '@playwright/test';

test.describe('OAuth gate', () => {
  test('shows Google login when auth is enabled without a session', async ({ page }) => {
    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          oauth_configured: true,
          firebase_configured: false,
          authenticated: false,
          user: null,
        }),
      });
    });

    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: 'TicOSClaw’a giriş yap' })).toBeVisible();
    const login = page.getByRole('link', { name: 'Google ile giriş yap' });
    await expect(login).toBeVisible();
    await expect(login).toHaveAttribute(
      'href',
      'http://localhost:8000/api/v1/auth/login?next=%2Fpricing',
    );
  });

  test('shows Firebase login button when firebase auth is configured', async ({ page }) => {
    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          oauth_configured: false,
          firebase_configured: true,
          authenticated: false,
          user: null,
        }),
      });
    });

    await page.goto('/pricing');

    await expect(page.getByRole('button', { name: 'Google ile giriş yap' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Google ile giriş yap' })).toHaveCount(0);
  });

  test('renders the app for an authenticated user and logs out', async ({ page }) => {
    let logoutCalled = false;
    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          authenticated: true,
          user: {
            id: 'google-user-123',
            email: 'owner@example.com',
            name: 'Store Owner',
            picture: '',
          },
        }),
      });
    });
    await page.route('**/api/v1/auth/logout', async (route) => {
      logoutCalled = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('/pricing');

    await expect(page.getByText('owner@example.com')).toBeVisible();
    await page.getByRole('button', { name: 'Çıkış yap' }).click();
    await expect.poll(() => logoutCalled).toBe(true);
  });
});
