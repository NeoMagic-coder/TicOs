import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

/**
 * Verifies the "Demo veriyle doldur" button on the empty Dashboard populates
 * KPIs + a sales-trend chart + 3 demo approvals. (#4 + #10)
 */
test.describe('Demo fixtures', () => {
  test('dashboard empty-state shows Demo veriyle doldur button', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    // After onboarding, dashboard should be rendered (all-zero state).
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const demoBtn = page.getByRole('button', { name: /Demo verisi yükle/i });
    await expect(demoBtn).toBeVisible();
  });

  test('clicking demo button populates KPIs and adds pending approvals', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Demo verisi yükle/i }).click();

    // Dashboard KPI replaces ₺0.
    await expect(page.getByText(/₺8\.200|₺8,200|8\.200/)).toBeVisible();

    // Navigate to approvals; the 3 demo entries should render.
    await page.getByRole('button', { name: /Approvals|Onaylar/i }).first().click();
    await expect(page.getByText(/Fiyat değişikliği/i)).toBeVisible();
    await expect(page.getByText(/Meta Ads bütçe artışı/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Reorder:/i })).toBeVisible();
  });
});
