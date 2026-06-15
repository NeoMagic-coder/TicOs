import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

test.describe('Sahibinden + Dolap channels', () => {
  test('appear on integrations page', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    await page.goto('/integrations');

    await expect(page.getByRole('heading', { name: /^Sahibinden$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Dolap$/ })).toBeVisible();
  });
});
