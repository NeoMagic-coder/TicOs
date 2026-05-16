import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers/onboard';

/**
 * #1 — Backend offline → Gemini fallback for Brand Identity regen.
 *
 * Stubs:
 *   - /api/v1/chat → 503 (simulating backend down)
 *   - generativelanguage.googleapis.com/** → valid Gemini response carrying
 *     the structured brand-identity JSON
 *
 * The store's regenerateBrandIdentity uses chatWithFallback, which should
 * detect the backend failure and call Gemini directly. The resulting brand
 * name must render on the Brand page.
 */

const GEMINI_PAYLOAD = {
  candidates: [
    {
      content: {
        role: 'model',
        parts: [
          {
            text:
              '```json\n' +
              JSON.stringify({
                brand_name: 'TermoForge',
                tagline: 'Sıcaklığı zamanla yarıştır.',
                story: 'Granit kaplama ile günlük kullanım için tasarlandı.',
                positioning: 'Türkiye\'nin en uzun ısı tutma süresine sahip termoslu seti.',
                alternatives: [
                  { name: 'Granitium', score: 82, domain: '✓', reasoning: 'Granit + premium çağrışım' },
                  { name: 'Termax', score: 76, domain: '✓', reasoning: 'Kısa ve akılda kalıcı' },
                  { name: 'GranKor', score: 70, domain: '✗', reasoning: 'Marka çakışması var' },
                  { name: 'IsıGuard', score: 68, domain: '✓', reasoning: 'Türkçe ama jenerik' },
                ],
                palette: [
                  { role: 'Primary', hex: '#1F2937', label: 'Gece Granit' },
                  { role: 'Secondary', hex: '#F59E0B', label: 'Ateş Sarısı' },
                  { role: 'Accent', hex: '#10B981', label: 'Yeşim' },
                  { role: 'Neutral', hex: '#F3F4F6', label: 'Bulut' },
                  { role: 'Dark', hex: '#0F172A', label: 'Kömür' },
                ],
                voice: { traits: ['Net', 'Sıcak'], do: ['Pratik konuş'], dont: ['Jargon kullanma'] },
                personas: [
                  { name: 'Pınar', age: '32', goal: 'Sağlıklı pişirme', objection: 'Fiyat', channel: 'Instagram', emoji: '👩' },
                  { name: 'Mert', age: '28', goal: 'Hızlı yemek', objection: 'Temizlik', channel: 'TikTok', emoji: '👨' },
                  { name: 'Ayşe', age: '45', goal: 'Dayanıklılık', objection: 'Marka tanınırlığı', channel: 'Facebook', emoji: '👩‍🦰' },
                ],
                social_handles: [
                  { platform: 'Instagram', handle: '@termoforge', available: true },
                  { platform: 'TikTok', handle: '@termoforge', available: true },
                  { platform: 'YouTube', handle: '@termoforge', available: true },
                  { platform: 'Twitter', handle: '@termoforge_tr', available: true },
                ],
              }) +
              '\n```',
          },
        ],
      },
      finishReason: 'STOP',
    },
  ],
};

test.describe('Gemini fallback when backend is offline', () => {
  test('Brand regen falls back to direct Gemini and renders brand_name', async ({ page }) => {
    // Backend is broken: /health says offline, /api/v1/chat returns 503.
    await page.route('**/health', (route) => route.abort('connectionrefused'));
    await page.route('**/api/v1/chat', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"backend down"}' }),
    );
    // Direct Gemini stub — the fallback path posts to generativelanguage.googleapis.com.
    await page.route('**generativelanguage.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(GEMINI_PAYLOAD),
      }),
    );

    await completeOnboarding(page);

    // Backend health pill should show the offline state.
    await expect(page.getByText(/Backend:\s*çevrimdışı/i)).toBeVisible({ timeout: 25_000 });

    // Navigate to the Brand page via sidebar (label may be "Marka" or "Brand").
    await page.getByRole('button', { name: /Marka|^Brand$/ }).first().click();
    await expect(page.getByRole('heading', { name: /Marka Kimliği/i })).toBeVisible();

    // Trigger regen. The button reads "Üret" the first time, "Yeniden Üret" otherwise.
    await page.getByRole('button', { name: /^Üret$|Yeniden Üret/ }).click();

    // Gemini fallback should populate the brand identity.
    await expect(page.getByRole('heading', { name: 'TermoForge' })).toBeVisible({ timeout: 15_000 });
    // Tagline is also part of the parsed payload — verify the page rendered the
    // structured response, not a raw error.
    await expect(page.getByText('Sıcaklığı zamanla yarıştır.')).toBeVisible();
  });
});
