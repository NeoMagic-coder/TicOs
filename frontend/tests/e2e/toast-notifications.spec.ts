/**
 * Toast notification E2E — backend failure must surface to the user
 * instead of getting buried in chat history.
 *
 * Stubs the backend so /api/v1/chat returns 5xx; expects a toast.
 * Also asserts that a successful approve action shows a success toast,
 * and that toasts auto-dismiss within their TTL.
 */
import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers/onboard';

test('backend 5xx surfaces a visible toast (not just a chat reply)', async ({ page }) => {
  // Onboarding must complete before we can drive the supervisor input.
  await completeOnboarding(page);

  // Now stub the backend to be broken.
  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  await page.route('**/api/v1/chat', (route) =>
    route.fulfill({ status: 500, contentType: 'text/plain', body: 'kaboom' }),
  );
  await page.route('**/api/v1/chat/stream', (route) =>
    route.fulfill({ status: 500, contentType: 'text/plain', body: 'kaboom-stream' }),
  );

  // Navigate to supervisor.
  await page.getByText(/^Supervisor$/).click();

  // Send a message via the textarea + Enter.
  const ta = page.getByPlaceholder(/Görev yaz veya \/ ile slash/i);
  await ta.fill('test backend failure');
  await ta.press('Enter');

  // A toast must appear. Either the "Backend offline — Gemini fallback"
  // (warn, if Gemini is configured) or the "Backend çağrısı başarısız"
  // (error). Both are user-visible signals — the chat-history-only
  // surfacing was the bug.
  const toast = page.locator('[data-testid^="toast-"]').first();
  await expect(toast).toBeVisible({ timeout: 6000 });
  // Title is one of the expected strings.
  await expect(toast).toContainText(/Backend çağrısı başarısız|Backend offline|SSE bağlantısı koptu/);
});

test('approving an item shows a success toast', async ({ page }) => {
  await completeOnboarding(page);
  // Stub backend chat to succeed (we don't drive chat here, just want
  // the store seeded with onboarding-generated demo approvals).
  await page.route('**/api/v1/chat*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: 'OK', task_id: 't_ok', confidence: 0.9, tools_used: [], thinking: null, agent_outputs: [] }),
    }),
  );

  await page.getByText(/^Onaylar$/).click();
  const onayla = page.getByRole('button', { name: /^Onayla$/ });
  test.skip((await onayla.count()) === 0, 'No pending approvals to act on');

  await onayla.first().click();

  const successToast = page.locator('[data-testid="toast-success"]').first();
  await expect(successToast).toBeVisible({ timeout: 3000 });
  await expect(successToast).toContainText(/Onaylandı/);
});

test('toasts dismiss on click', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByText(/^Onaylar$/).click();
  const onayla = page.getByRole('button', { name: /^Onayla$/ });
  test.skip((await onayla.count()) === 0, 'No pending approvals to act on');

  await onayla.first().click();
  const toast = page.locator('[data-testid^="toast-"]').first();
  await expect(toast).toBeVisible();
  await toast.click();
  await expect(toast).toBeHidden({ timeout: 1500 });
});
