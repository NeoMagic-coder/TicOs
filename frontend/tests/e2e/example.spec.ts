import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TicOSClaw/i);
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should show onboarding entry screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('ticosclaw-brand')).toContainText('TICOSCLAW');
    await expect(page.getByRole('heading', { name: 'Define product.' })).toBeVisible();
  });
});
