import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

/**
 * #2 — Görev retry & observability.
 *
 * Drives the new-task flow with a stubbed backend so a Task materializes,
 * then opens the detail view and asserts the Logs + Iterations tabs render
 * along with the "Yeniden Çalıştır" button.
 */
test.describe('Task detail tabs + retry', () => {
  test('opens task detail, shows tabs, retry button works', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    // Onboarding auto-dispatches an "ön analiz" task — wait for it to land.
    await page.getByRole('button', { name: /Tasks|Görevler/i }).first().click();
    const taskCard = page.getByText(/ön analiz/i).first();
    await expect(taskCard).toBeVisible({ timeout: 15_000 });
    await taskCard.click();

    // Tabs exist
    await expect(page.getByRole('tab', { name: /Sonuç/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Loglar/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /İterasyon/i })).toBeVisible();

    // Retry button exists and is enabled.
    const retry = page.getByRole('button', { name: /Yeniden Çalıştır/i });
    await expect(retry).toBeEnabled();

    // Switching tabs surfaces tab-specific headings.
    await page.getByRole('tab', { name: /Loglar/i }).click();
    await expect(page.getByRole('heading', { name: /Audit Logları/i })).toBeVisible();

    await page.getByRole('tab', { name: /İterasyon/i }).click();
    await expect(page.getByRole('heading', { name: /İterasyon Geçmişi/i })).toBeVisible();
  });
});
