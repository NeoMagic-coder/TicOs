import { test as base } from '@playwright/test';
import { completeOnboarding, stubBackend } from '../helpers/onboard';

/**
 * Shared Playwright fixtures for OneProduct Agent OS e2e tests.
 *
 * Usage:
 *   import { test, expect } from './fixtures';
 *   test('dashboard KPIs', async ({ onboardedPage }) => { ... });
 */
export const test = base.extend({
  /** Page with backend stubs and completed onboarding wizard. */
  onboardedPage: async ({ page }, use) => {
    await stubBackend(page);
    await completeOnboarding(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
