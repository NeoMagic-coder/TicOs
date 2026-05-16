import { type Page, expect } from '@playwright/test';

/**
 * Drive the 5-step onboarding wizard to completion and land on the dashboard.
 *
 * Used by specs that need an onboarded workspace as setup. All steps use
 * role/text locators (golden-rules.md #1).
 */
export async function completeOnboarding(
  page: Page,
  opts: { productName?: string; category?: string; channel?: string } = {},
): Promise<void> {
  const productName = opts.productName ?? 'Yanmaz Tencere';
  const category = opts.category ?? 'Mutfak';
  const channel = opts.channel ?? 'Shopify';

  await page.goto('/');
  // Step 1
  await page.getByPlaceholder(/Granit Yanmaz Tencere/i).fill(productName);
  await page.getByPlaceholder(/Ev & Mutfak/i).fill(category);
  await page.getByRole('button', { name: /Devam/i }).click();
  // Step 2
  await page.getByText('Ürünüm var, mağaza yok').click();
  await page.getByRole('button', { name: /Devam/i }).click();
  // Step 3
  await page.getByRole('button', { name: /Türkiye/i }).click();
  await page.getByRole('button', { name: channel, exact: true }).click();
  await page.getByRole('button', { name: /5k-25k/i }).click();
  await page.getByRole('button', { name: /Devam/i }).click();
  // Step 4
  await page.getByRole('button', { name: /Hızlı satış başlatmak/i }).click();
  await page.getByRole('button', { name: /Devam/i }).click();
  // Step 5
  await expect(page.getByText('Hazırız!')).toBeVisible();
  await page.getByRole('button', { name: /İlk Analizi Başlat/i }).click();
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
