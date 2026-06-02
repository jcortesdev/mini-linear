import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('/sign-in', () => {
  test('renders all auth options without axe violations', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByRole('heading', { name: /sign in to mini-linear/i })).toBeVisible();

    // Try-the-demo + 3 OAuth + magic link form: every sign-in path is on screen.
    await expect(page.getByRole('button', { name: /try the demo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with linkedin/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      // Ignore violations in third-party (e.g. Next.js dev tools overlay) that
      // we can't fix and that don't ship to production.
      .exclude('[data-nextjs-dev-tools-button]')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
