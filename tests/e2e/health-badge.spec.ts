import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers/onboard';

/**
 * Verifies the backend health pill in ProductContextBar reflects /health
 * reachability. (#3)
 *
 * Mocks the /health endpoint to return online vs. offline and asserts the
 * pill's text + color hint.
 */
test.describe('Health badge', () => {
  test('shows "Backend: online" when /health returns 200', async ({ page }) => {
    await page.route('**/health', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );
    await page.route('**/api/v1/chat', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        content: '', task_id: 't', confidence: 0, tools_used: [], thinking: null, agent_outputs: [],
      }) }),
    );

    await completeOnboarding(page);
    await expect(page.getByText(/Backend:\s*online/i)).toBeVisible({ timeout: 25_000 });
  });

  test('shows "çevrimdışı" when /health is unreachable', async ({ page }) => {
    await page.route('**/health', (route) => route.abort('connectionrefused'));

    await completeOnboarding(page);
    await expect(page.getByText(/Backend:\s*çevrimdışı/i)).toBeVisible({ timeout: 25_000 });
  });
});
