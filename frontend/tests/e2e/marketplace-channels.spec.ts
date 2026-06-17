import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

/**
 * Sahibinden + Dolap kanal entegrasyon testleri.
 *
 * Asserts the new channels appear in:
 *  - onboarding step 3 (channel chips)
 *  - Integrations page "Eklenebilir Kanallar" section
 */
test.describe('Sahibinden + Dolap channels', () => {
  test('appear as selectable chips in onboarding step 3', async ({ page }) => {
    await page.goto('/');
    // Step 1
    await page.getByPlaceholder(/Granit Yanmaz Tencere/i).fill('Test');
    await page.getByPlaceholder(/Ev & Mutfak/i).fill('Test');
    await page.getByRole('button', { name: /Devam/i }).click();
    // Step 2
    await page.getByText('Ürünüm var, mağaza yok').click();
    await page.getByRole('button', { name: /Devam/i }).click();
    // Step 3 — channel chips
    await expect(page.getByRole('button', { name: 'Sahibinden', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dolap', exact: true })).toBeVisible();
  });

  test('can be connected from Integrations page', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Integrations|Entegrasyon/i }).first().click();

    await expect(page.getByRole('heading', { name: /^Sahibinden$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Dolap$/ })).toBeVisible();

    // Each "Eklenebilir" card has a single "Bağla" button. Click the one
    // that lives in the Sahibinden card's nearest ancestor div.
    const sahibindenHeading = page.getByRole('heading', { name: /^Sahibinden$/ }).first();
    const sahibindenCard = sahibindenHeading.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await sahibindenCard.getByRole('button', { name: /Bağla/i }).click();

    // After connecting, a "Bağlı" pill appears next to Sahibinden in the
    // "Bağlı Kanallar" list at the top of the page.
    await expect(page.getByText(/Bağlı/i).first()).toBeVisible();
  });
});
