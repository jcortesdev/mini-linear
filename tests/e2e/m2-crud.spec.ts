import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

const TEST_PREFIX = '[e2e]';

/**
 * Walks the M2 happy path end-to-end through the deployed demo workspace:
 * sign in anonymously, create an issue, edit its title inline, open the detail
 * panel, delete + undo. Each step verifies both the optimistic flash (the row
 * appears/changes/vanishes immediately) and persistence across reload.
 *
 * Every title carries the `[e2e]` prefix so `afterEach` can hard-delete
 * anything left behind without touching real demo data.
 */
test.describe('M2 issue crud', () => {
  // Anonymous demo users all land in the same shared workspace, so running
  // create/edit/delete in parallel would have each test seeing the others'
  // rows (and the `initialCount` baselines would drift). Serial keeps the
  // baseline stable and lets afterEach clean up before the next test starts.
  test.describe.configure({ mode: 'serial' });

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

  test.afterEach(async ({ page }) => {
    await purgeE2eIssues(page);
  });

  test('creates an issue with optimistic insert and persists after reload', async ({ page }) => {
    const title = `${TEST_PREFIX} create ${Date.now()}`;
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
    // Create our own row so the rename doesn't touch shared seed data.
    const original = `${TEST_PREFIX} original ${Date.now()}`;
    const renamed = `${TEST_PREFIX} renamed ${Date.now()}`;

    await page.keyboard.press('c');
    await page.getByLabel('New issue title').fill(original);
    await page.getByLabel('New issue title').press('Enter');
    const row = page.locator('li[data-row-index]', { hasText: original }).first();
    await expect(row).toBeVisible({ timeout: 2_000 });
    // Wait for server confirmation (the Link only renders once the optimistic
    // UUID is replaced with a real Convex id) to avoid racing the re-render.
    await expect(row.locator('a[data-issue-row-id]')).toBeVisible({ timeout: 5_000 });
    // Pin the row by its current data-row-index — once we click edit, the row
    // swaps the button for an input and `hasText` would stop matching the row.
    const rowIndex = await row.getAttribute('data-row-index');

    await row.locator('button[data-edit-title]').click();
    const editingRow = page.locator(`li[data-row-index="${rowIndex}"]`);
    const input = editingRow.locator('input[aria-label*="Edit title"]');
    await expect(input).toBeFocused();
    await input.fill(renamed);
    await input.press('Enter');

    await expect(page.getByText(renamed)).toBeVisible();
    await page.reload();
    await expect(page.getByText(renamed)).toBeVisible();
  });

  test('deletes from the detail panel and undo restores the row', async ({ page }) => {
    const title = `${TEST_PREFIX} delete ${Date.now()}`;
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

/**
 * Hard-delete any issues we created this run. Talks to the in-page Convex
 * client (exposed on `window.__convex` in dev/test builds). Doing this via the
 * UI would be slow and brittle, and soft-delete would just hide the rows.
 */
async function purgeE2eIssues(page: Page) {
  await page
    .evaluate(async (prefix) => {
      type ConvexLike = { mutation: (name: string, args: unknown) => Promise<unknown> };
      const client = (window as unknown as { __convex?: ConvexLike }).__convex;
      if (!client) return;
      await client.mutation('issues:purgeByTitlePrefix', { prefix });
    }, TEST_PREFIX)
    .catch(() => {
      // Don't fail the suite on cleanup errors — flaky network shouldn't mask
      // real assertion failures.
    });
}
