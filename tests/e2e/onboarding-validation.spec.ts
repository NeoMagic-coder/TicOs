import { test, expect } from '@playwright/test';

/**
 * Verifies the inline-validation hint introduced in #5: when required step-1
 * fields are empty, the "Devam" button is disabled AND a role="alert" block
 * surfaces the missing field names.
 */
test.describe('Onboarding validation', () => {
  test('shows inline alert listing missing fields when Devam is disabled', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ürününüz ne?' })).toBeVisible();

    // Type just the product name → category still missing.
    await page.getByPlaceholder(/Granit Yanmaz Tencere/i).fill('Yanmaz Tencere');

    const next = page.getByRole('button', { name: /Devam/i });
    await expect(next).toBeDisabled();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Kategori/i);
    await expect(alert).not.toContainText(/Ürün adı/i);
  });

  test('alert disappears and Devam enables once both fields are filled', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/Granit Yanmaz Tencere/i).fill('Test');
    await page.getByPlaceholder(/Ev & Mutfak/i).fill('Test');

    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Devam/i })).toBeEnabled();
  });
});
