import { test, expect } from '@playwright/test';

/**
 * Onboarding smoke tests.
 *
 * Asserts the onboarding screen renders and the wizard advances step-by-step.
 * No backend calls are made from step 1 → 4, so no route stubbing is needed
 * for these checks. The full happy-path (with chat) lives in
 * onboarding-chat-flow.spec.ts.
 */
test.describe('Onboarding smoke', () => {
  test('renders step 1 with product name + category fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OneProduct Agent OS' })).toBeVisible();
    await expect(page.getByText('Bir ürün. Tüm e-ticaret. Tamamen otonom.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ürününüz ne?' })).toBeVisible();

    // The Devam button is rendered but disabled until required fields are filled.
    const next = page.getByRole('button', { name: /Devam/i });
    await expect(next).toBeVisible();
    await expect(next).toBeDisabled();
  });

  test('advances to step 2 once product name + category are filled', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/Granit Yanmaz Tencere/i).fill('Yanmaz Tencere');
    await page.getByPlaceholder(/Ev & Mutfak/i).fill('Mutfak');

    const next = page.getByRole('button', { name: /Devam/i });
    await expect(next).toBeEnabled();
    await next.click();

    await expect(page.getByRole('heading', { name: 'Nereden başlamak istiyorsunuz?' })).toBeVisible();
  });

  test('renders without page-level errors on first load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, `Page errors: ${errors.join('; ')}`).toEqual([]);
  });
});
