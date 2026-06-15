import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TicOSClaw/i);
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should show onboarding entry screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('ticosclaw-brand')).toContainText('TicOSClaw');
    await expect(page.getByRole('heading', { name: 'Hoş geldin' })).toBeVisible();
  });
});
