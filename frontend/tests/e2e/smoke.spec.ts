import { test, expect, request } from '@playwright/test';

/**
 * Hackathon smoke testi — demo senaryosunun kritik adımlarını uçtan uca
 * doğrular. `scripts/check.sh` tarafından çağrılır.
 *
 * Servisler docker compose ile zaten ayağa kaldırılmış olmalı:
 *   - backend  → http://localhost:8000
 *   - frontend → http://localhost:5173
 *
 * playwright.config.ts içindeki `webServer.reuseExistingServer` sayesinde
 * Playwright çalışan Vite'i yeniden başlatmaz.
 */

const API = 'http://localhost:8000';
const APP = 'http://localhost:5173';

test.describe('hackathon smoke', () => {
  test('backend /health is OK', async () => {
    const api = await request.newContext();
    const res = await api.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('frontend root loads (200 + non-empty html)', async ({ page }) => {
    const response = await page.goto(APP, { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();
    // Ana root divi mount edilmiş olmalı.
    await expect(page.locator('#root')).toBeVisible();
  });

  test('demo /play streams the 6 critical steps', async () => {
    const api = await request.newContext();
    const res = await api.post(`${API}/api/v1/demo/play`, {
      data: { scenario: '3hour_race', speed_multiplier: 600 },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.text();

    // Critical steps the demo race must surface.
    const required = [
      'product_analysis',
      'brand_identity_generation',
      'pricing_optimization',
      'trendyol_listing',
      'negotiation_with_supplier',
      'roi_calculation',
    ];
    for (const step of required) {
      expect(body, `missing step: ${step}`).toContain(step);
    }
    // Final summary frame must arrive.
    expect(body).toContain('event: summary');
  });
});
