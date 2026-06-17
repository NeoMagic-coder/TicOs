import { test, expect } from '@playwright/test';

/**
 * Full happy-path E2E: complete the 5-step onboarding wizard, navigate to
 * Chat, send a message, and assert the (stubbed) backend response renders.
 *
 * The backend is stubbed via page.route — we never hit a real FastAPI server.
 * This lets the test run in CI without standing up Python.
 */

const STUB_RESPONSE = {
  content:
    'Pazar araştırması özeti: tencere kategorisinde talep yüksek, rekabet orta.\n\n' +
    '• Aylık arama hacmi 220k\n• Top-3 rakip pazar payı %38\n⚠️ Onay: Trendyol başlangıç bütçesi ₺15k',
  task_id: 'task_e2e_stub',
  confidence: 0.88,
  tools_used: ['google_trends_query', 'competitor_profile_builder'],
  thinking: null,
  agent_outputs: [
    {
      agent_id: 'market_research_agent',
      task_id: 'task_e2e_stub',
      status: 'completed',
      confidence: 0.88,
      iterations_used: 1,
      tools_called: [],
      summary: 'Pazar araştırması tamamlandı.',
      content: 'Pazar araştırması özeti: tencere kategorisinde talep yüksek, rekabet orta.',
      findings: ['220k aylık arama', 'Top-3 rakip %38 pazar payı'],
      recommended_actions: [],
      next_step: null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
  ],
};

test('onboarding → chat → mocked backend response renders', async ({ page }) => {
  // Stub the backend /api/v1/chat call regardless of host:port the frontend uses.
  await page.route('**/api/v1/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_RESPONSE),
    });
  });
  // SSE stream — fail it so the store falls back to the buffered /api/v1/chat
  // path stubbed above. Without this stub a live FastAPI on :8000 would answer
  // SSE first and bypass our mock entirely.
  await page.route('**/api/v1/chat/stream', (route) =>
    route.fulfill({ status: 503, contentType: 'text/plain', body: 'stream disabled' }),
  );
  // /health probe — return ok so any reachability check succeeds.
  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );

  await page.goto('/');

  // --- Step 1: product name + category ---
  await expect(page.getByText('Ürününüz ne?')).toBeVisible();
  await page.getByPlaceholder(/Granit Yanmaz Tencere/i).fill('Yanmaz Tencere');
  await page.getByPlaceholder(/Ev & Mutfak/i).fill('Mutfak');
  await page.getByRole('button', { name: /Devam/i }).click();

  // --- Step 2: stage ---
  await expect(page.getByText('Nereden başlamak istiyorsunuz?')).toBeVisible();
  await page.getByText('Ürünüm var, mağaza yok').click();
  await page.getByRole('button', { name: /Devam/i }).click();

  // --- Step 3: target market, channel, budget ---
  await expect(page.getByText('Hedef pazarınız ve bütçeniz?')).toBeVisible();
  await page.getByRole('button', { name: /Türkiye/i }).click();
  await page.getByRole('button', { name: 'Shopify', exact: true }).click();
  await page.getByRole('button', { name: /5k-25k/i }).click();
  await page.getByRole('button', { name: /Devam/i }).click();

  // --- Step 4: priorities ---
  await expect(page.getByText('Öncelikleriniz?')).toBeVisible();
  await page.getByRole('button', { name: /Hızlı satış başlatmak/i }).click();
  await page.getByRole('button', { name: /Devam/i }).click();

  // --- Step 5: summary + start ---
  await expect(page.getByText('Hazırız!')).toBeVisible();
  await page.getByRole('button', { name: /İlk Analizi Başlat/i }).click();

  // --- Dashboard renders, navigate to Chat ---
  await page.getByRole('button', { name: /^Chat$/i }).click();
  await expect(page.getByText('Supervisor Chat')).toBeVisible();

  // --- Send a chat message that routes to market_research_agent ---
  const input = page.getByPlaceholder(/Supervisor'a mesaj/i);
  await input.fill('Pazar araştırması yap ve rakipleri çıkar');
  await page.getByRole('button', { name: /Gönder/i }).click();

  // --- User bubble appears (input value + chat bubble both contain the text;
  //     match the chat bubble specifically via .first()) ---
  await expect(page.getByText('Pazar araştırması yap ve rakipleri çıkar').first()).toBeVisible();

  // --- Mocked assistant response renders (content + tool chips) ---
  await expect(
    page.getByText(/tencere kategorisinde talep yüksek/i),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('google_trends_query')).toBeVisible();
  await expect(page.getByText('competitor_profile_builder')).toBeVisible();
});
