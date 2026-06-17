import { test, expect } from '@playwright/test';
import { completeOnboarding, stubBackend } from './helpers/onboard';

/**
 * #6 — header command launcher.
 *
 * After onboarding, the ProductContextBar exposes a "Komut" button with a
 * Cmd+K hint and a rotating suggestion chip. Pressing Ctrl+K toggles the
 * Supervisor dock.
 */
test.describe('Command launcher', () => {
  test('header exposes ⌘K hint button + rotating suggestion chip', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    await expect(page.getByRole('button', { name: /Komut paletini aç/i })).toBeVisible();
    // The rotating suggestion lives inside a button with title 'Bu öneriyi Supervisor\'a gönder'.
    await expect(page.locator('button[title*="öneriyi Supervisor"]')).toBeVisible();
  });

  test('Ctrl+K opens the Supervisor dock', async ({ page }) => {
    await stubBackend(page);
    await completeOnboarding(page);

    // The floating chip is the "closed" state.
    await expect(page.getByRole('button', { name: /Supervisor/ })).toBeVisible();

    await page.keyboard.press('Control+K');

    // Once open, the dock renders the chat input.
    await expect(page.getByPlaceholder(/Komut ver veya soru sor/i)).toBeVisible();
  });
});
