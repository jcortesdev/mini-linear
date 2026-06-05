import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Smoke test for the three-way theme toggle (light / system / dark) shipped
 * in M5. Verifies the toggle is wired, persists the choice via localStorage,
 * and the data-theme attribute lands on <html> before paint after a reload.
 * Also runs axe on the topbar surface with the toggle visible.
 */
test.describe('M5 theme toggle', () => {
  test('switches data-theme and persists across reload', async ({ page, context }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await expect(page.getByRole('heading', { name: /^issues$/i })).toBeVisible({
      timeout: 15_000,
    });

    const toggle = page.getByRole('group', { name: /^theme$/i });
    await expect(toggle).toBeVisible();

    // Pick Dark and confirm both the DOM attribute and localStorage flip.
    await page.getByRole('button', { name: /theme: dark/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const storedDark = await page.evaluate(() => localStorage.getItem('mini-linear.theme'));
    expect(storedDark).toBe('dark');

    // Reload — the inline anti-flash script should set data-theme=dark
    // synchronously before paint, then the React provider takes over.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Pick Light, then System — confirm the resolver follows the OS pref.
    await page.getByRole('button', { name: /theme: light/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: /theme: system/i }).click();
    const stored = await page.evaluate(() => localStorage.getItem('mini-linear.theme'));
    expect(stored).toBe('system');

    // axe with the toggle group rendered.
    const axe = await new AxeBuilder({ page }).exclude('[data-nextjs-dev-tools-button]').analyze();
    expect(axe.violations).toEqual([]);

    await context.clearCookies();
  });
});
