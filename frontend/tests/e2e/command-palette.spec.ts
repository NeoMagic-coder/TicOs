import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers/onboard';

test.describe('Soru Sor', () => {
  test('Soru Sor sekmesi görünür', async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.getByRole('tab', { name: 'Soru Sor' })).toBeVisible();
  });

  test('büyük Gönder düğmesi', async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.getByPlaceholder(/Bugün ne yapmalım/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Gönder/i })).toBeVisible();
  });
});
