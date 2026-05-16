import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

/**
 * #7 — product switcher dropdown in ProductContextBar.
 *
 * After onboarding, clicking the active-product pill should expose a listbox
 * containing the active product plus a "Yeni ürün ekle" entry that navigates
 * back to the onboarding wizard.
 */
test.describe('Product switcher', () => {
  test('opens dropdown with active product + add-new entry', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page, { productName: 'Yanmaz Tencere' });

    const switcher = page.getByRole('button', { name: /Aktif ürünü değiştir:.*Yanmaz Tencere/i });
    await expect(switcher).toBeVisible();
    await switcher.click();

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await expect(listbox.getByText('Yanmaz Tencere')).toBeVisible();
    await expect(listbox.getByText(/Yeni ürün ekle/i)).toBeVisible();
  });

  test('add-new entry routes to onboarding wizard', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Aktif ürünü değiştir/i }).first().click();
    await page.getByText(/Yeni ürün ekle/i).click();

    await expect(page.getByRole('heading', { name: 'Ürününüz ne?' })).toBeVisible();
  });
});
