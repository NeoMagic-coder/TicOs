import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

/**
 * #8 — Agent mikro-status satırı + detayda Trace bölümü.
 *
 * After onboarding, the Agents page must:
 *   - render each agent card with a "şu an: ..." / "son aktivite ..." line
 *   - clicking a card opens a detail view with a "Trace — Son Aktivite" section
 */
test.describe('Agent micro-status + trace', () => {
  test('agent card surfaces a recent-activity line', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Agent Office/i }).first().click();
    await expect(page.getByRole('heading', { name: /Agent Office/i })).toBeVisible();

    // Every card has the activity line — match the literal phrasing used in
    // the component: "son aktivite" (no recent task) or "şu an:" (live).
    const activityLines = page.locator('div', { hasText: /son aktivite|şu an:/i });
    expect(await activityLines.count()).toBeGreaterThan(0);
  });

  test('agent detail renders the Trace section', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Agent Office/i }).first().click();
    await expect(page.getByRole('heading', { name: /Agent Office/i })).toBeVisible();

    // Open the first agent card.
    await page.locator('div.cursor-pointer').first().click();

    await expect(page.getByRole('heading', { name: /Trace — Son Aktivite/i })).toBeVisible();
  });
});
