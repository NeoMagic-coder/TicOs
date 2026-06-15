import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

test.describe('Product display', () => {
  test('shows product name on Tüm özellikler home', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page, { productName: 'Yanmaz Tencere' });
    await page.getByRole('tab', { name: 'Tüm özellikler' }).click();
    await expect(page.getByRole('heading', { name: 'Tüm özellikler' })).toBeVisible();
    await expect(page.locator('.easy-features__welcome')).toContainText('Yanmaz Tencere');
  });
});
