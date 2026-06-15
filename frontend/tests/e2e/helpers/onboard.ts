import { type Page, expect } from '@playwright/test';

/**
 * Hızlı onboarding — ürün adı + Devam.
 */
export async function completeOnboarding(
  page: Page,
  opts: { productName?: string; stub?: boolean } = {},
): Promise<void> {
  const productName = opts.productName ?? 'Yanmaz Tencere';
  const stub = opts.stub ?? true;

  if (stub) await stubBackend(page);

  await page.goto('/');
  await page.getByPlaceholder(/Tencere/i).fill(productName);
  await page.getByRole('button', { name: /^Devam$/ }).click();
  await expect(page.getByTestId('quick-onboarding')).not.toBeVisible({ timeout: 15000 });
}

/** Stub the backend /api/v1/chat and /health endpoints so tests run offline. */
export async function stubBackend(page: Page, opts: { health?: 'ok' | 'offline' } = {}): Promise<void> {
  const health = opts.health ?? 'ok';
  if (health === 'ok') {
    await page.route('**/health', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );
  } else {
    await page.route('**/health', (route) => route.abort('connectionrefused'));
  }
  await page.route('**/api/v1/products**', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: 'OK',
        task_id: 't_stub',
        confidence: 0.8,
        tools_used: [],
        thinking: null,
        agent_outputs: [],
      }),
    }),
  );
}
