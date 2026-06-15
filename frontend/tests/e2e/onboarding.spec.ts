import { test, expect } from '@playwright/test';

test.describe('Hızlı onboarding', () => {
  test('renders product name field and Devam button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('ticosclaw-brand')).toContainText('TicOSClaw');
    await expect(page.getByRole('heading', { name: 'Hoş geldin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Devam' })).toBeDisabled();
  });

  test('starts app when product name is filled', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/Tencere/i).fill('Test Ürün');
    const start = page.getByRole('button', { name: 'Devam' });
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page.getByTestId('quick-onboarding')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Tüm özellikler' })).toHaveAttribute('aria-selected', 'true');
  });

  test('renders without page-level errors on first load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, `Page errors: ${errors.join('; ')}`).toEqual([]);
  });
});
