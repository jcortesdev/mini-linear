import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Walks the M2 happy path end-to-end through the deployed demo workspace:
 * sign in anonymously, create an issue, edit its title inline, open the detail
 * panel, delete + undo. Each step verifies both the optimistic flash (the row
 * appears/changes/vanishes immediately) and persistence across reload.
 */
test.describe('M2 issue crud', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /try the demo/i }).click();
    // After anonymous sign-in the URL may stay on /sign-in for a beat while
    // Next renders the /issues content underneath; wait on the heading instead.
    await expect(page.getByRole('heading', { name: /^issues$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('li[data-row-index="0"]')).toBeVisible();
  });

  test('creates an issue with optimistic insert and persists after reload', async ({ page }) => {
    const title = `e2e create ${Date.now()}`;
    const initialCount = await page.locator('li[data-row-index]').count();

    await page.keyboard.press('c');
    await expect(page.getByLabel('New issue title')).toBeFocused();
    await page.getByLabel('New issue title').fill(title);
    await page.getByLabel('New issue title').press('Enter');

    // Optimistic insert: the new row is on screen before the server reply.
    await expect(page.getByText(title)).toBeVisible({ timeout: 2_000 });
    await expect(page.locator('li[data-row-index]')).toHaveCount(initialCount + 1);

    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
  });

  test('edits a title inline and persists after reload', async ({ page }) => {
    const firstRow = page.locator('li[data-row-index="0"]');
    const editButton = firstRow.locator('button[data-edit-title]');
    const originalTitle = (await editButton.textContent())?.trim() ?? '';
    const newTitle = `e2e renamed ${Date.now()}`;

    await editButton.click();
    const input = firstRow.locator('input[aria-label*="Edit title"]');
    await expect(input).toBeFocused();
    await input.fill(newTitle);
    await input.press('Enter');

    await expect(firstRow.getByText(newTitle)).toBeVisible();
    await page.reload();
    await expect(page.locator('li[data-row-index="0"]').getByText(newTitle)).toBeVisible();
    expect(originalTitle).not.toEqual(newTitle);
  });

  test('deletes from the detail panel and undo restores the row', async ({ page }) => {
    // Make our own throwaway issue so the test is self-contained — the seeded
    // issues are shared with the other tests in this file.
    const title = `e2e delete ${Date.now()}`;
    await page.keyboard.press('c');
    await page.getByLabel('New issue title').fill(title);
    await page.getByLabel('New issue title').press('Enter');
    const targetRow = page.locator('li[data-row-index]', { hasText: title }).first();
    await expect(targetRow).toBeVisible({ timeout: 2_000 });
    // Wait for the optimistic UUID to be swapped for the server-assigned id —
    // the row's <Link> only renders once that happens.
    await expect(targetRow.locator('a[data-issue-row-id]')).toBeVisible({ timeout: 5_000 });

    await targetRow.locator('a[data-issue-row-id]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // axe on the slide-over: this is the one new route the module ships.
    const axe = await new AxeBuilder({ page }).exclude('[data-nextjs-dev-tools-button]').analyze();
    expect(axe.violations).toEqual([]);

    await dialog.getByRole('button', { name: /delete issue/i }).click();
    await expect(page.getByText(title)).toHaveCount(0);

    const toast = page.getByLabel('Notifications');
    await expect(toast.getByRole('button', { name: /undo/i })).toBeVisible();
    await toast.getByRole('button', { name: /undo/i }).click();

    // After Undo, the row reappears and survives a reload.
    await expect(page.getByText(title)).toBeVisible({ timeout: 4_000 });
    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
  });
});
