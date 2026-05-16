import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers/onboard';

/**
 * Images produced by agents must render as <img> in:
 *  - the main ChatPage
 *  - the floating SupervisorChatDock
 *  - the Brand page "Ajan Görselleri" gallery
 *
 * The backend response carries a markdown image reference; the frontend's
 * extractImageUrls() resolves /images/* paths against BASE_URL and the
 * ChatMessageBody component renders <img>.
 */

const STUB = {
  content: 'Logo hazırlandı.\n\n![logo](/images/agent_visual.png)',
  task_id: 'task_img',
  confidence: 0.9,
  tools_used: ['brand_visual_generator'],
  thinking: null,
  agent_outputs: [
    {
      agent_id: 'brand_identity_agent',
      task_id: 'task_img',
      status: 'completed',
      confidence: 0.9,
      iterations_used: 1,
      tools_called: [],
      summary: 'Logo üretildi.',
      content: 'Logo hazırlandı. ![logo](/images/agent_visual.png)',
      findings: [],
      recommended_actions: [],
      next_step: null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
  ],
};

test.describe('Agent image rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/health', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );
    await page.route('**/api/v1/chat', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB) }),
    );
    // The frontend resolves /images/* against BASE_URL. Stub the actual image
    // request with a 1×1 PNG so the <img> is "loaded" in the test runtime.
    await page.route('**/images/agent_visual.png', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
  });

  test('dock renders <img> for agent-produced markdown image', async ({ page }) => {
    await completeOnboarding(page);

    // Open the dock via Ctrl+K and send a request.
    await page.keyboard.press('Control+K');
    const input = page.getByPlaceholder(/Komut ver veya soru sor/i);
    await input.fill('Logo üret');
    await page.getByRole('button', { name: /Gönder/i }).click();

    // The dock should render an <img alt="agent görsel"> pointing to the
    // stubbed image URL.
    const img = page.locator('img[alt="agent görsel"]');
    await expect(img.first()).toBeVisible({ timeout: 10_000 });
    const src = await img.first().getAttribute('src');
    expect(src).toMatch(/\/images\/agent_visual\.png$/);
  });

  test('brand page gallery surfaces images from chat history', async ({ page }) => {
    await completeOnboarding(page);

    // Trigger an agent response carrying an image, then navigate to Brand.
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/Komut ver veya soru sor/i).fill('Logo üret');
    await page.getByRole('button', { name: /Gönder/i }).click();
    await expect(page.locator('img[alt="agent görsel"]').first()).toBeVisible({ timeout: 10_000 });

    // Sidebar label for the Brand route is just "Marka".
    await page.getByRole('button', { name: /^Marka$/ }).first().click();
    await expect(page.getByRole('heading', { name: /Ajan Görselleri/i })).toBeVisible();
    // At least one <img> inside the gallery section should render.
    const galleryHeading = page.getByRole('heading', { name: /Ajan Görselleri/i });
    const gallerySection = galleryHeading.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(gallerySection.locator('img[alt="agent görsel"]').first()).toBeVisible();
  });
});
