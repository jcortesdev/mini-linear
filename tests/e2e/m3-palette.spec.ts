import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

// Distinct from the M2 suite's `[e2e]` so the two files can run in parallel
// (default Playwright workers > 1) without afterEach hooks purging rows the
// other test is still asserting on.
const TEST_PREFIX = '[e2e-m3]';

/**
 * Drives the M3 command palette through its happy paths in the deployed demo
 * workspace: open/close, navigation, `g i`/`g b` sequences, `?` deep link,
 * contextual actions on an open issue, and the axe sweep.
 *
 * Every issue we create carries the `[e2e]` prefix so `afterEach` can hard-
 * delete anything left behind without touching real demo data.
 */
test.describe('M3 command palette', () => {
  // Anonymous demo users share the same workspace; serial keeps row baselines
  // stable across tests, same as the M2 suite.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await expect(page.getByRole('heading', { name: /^issues$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('li[data-row-index="0"]')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await purgeE2eIssues(page);
  });

  test('opens via the topbar trigger and Esc restores focus to it', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /^open command palette$/i });
    // Focus + click via the DOM directly. Playwright's high-level `click()`
    // routes through CDP and the trigger doesn't always end up as
    // document.activeElement before Radix Dialog's FocusScope snapshots it on
    // mount — which means on close FocusScope restores to <body>. Calling
    // focus() then click() in the page guarantees activeElement is the trigger
    // when FocusScope reads it.
    await trigger.evaluate((el: HTMLButtonElement) => {
      el.focus();
      el.click();
    });

    const palette = page.getByRole('dialog', { name: /command palette/i });
    await expect(palette).toBeVisible();
    await expect(page.getByRole('combobox', { name: /command palette/i })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('opens via ⌘K from anywhere in the app', async ({ page }) => {
    // Focus an unrelated element so the palette open isn't tied to a click.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+K');
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /command palette/i })).toBeFocused();
  });

  test('navigates to /board via palette and back to /issues via g i', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+K');
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await expect(palette).toBeVisible();

    await page.getByRole('combobox', { name: /command palette/i }).fill('board');
    // The shortcuts group also has a "Go to Board" doc entry — scope to the
    // actionable item via its data-value.
    await palette.locator('[cmdk-item][data-value="go to board"]').click();

    await expect(page).toHaveURL(/\/board$/);
    await expect(palette).not.toBeVisible();

    // Leader sequence — the matcher's 900ms window is generous, but Playwright's
    // default key cadence is fast enough that adjacent presses are well inside.
    await page.keyboard.press('g');
    await page.keyboard.press('i');
    await expect(page).toHaveURL(/\/issues$/);
  });

  test('opens contextual groups and changes status on the open issue', async ({ page }) => {
    const title = `${TEST_PREFIX} palette status ${Date.now()}`;
    await page.keyboard.press('c');
    await page.getByLabel('New issue title').fill(title);
    await page.getByLabel('New issue title').press('Enter');
    const row = page.locator('li[data-row-index]', { hasText: title }).first();
    await expect(row.locator('a[data-issue-row-id]')).toBeVisible({ timeout: 5_000 });

    await row.locator('a[data-issue-row-id]').click();
    // Slide-over (intercepting route) mounts on click. Single dialog at this
    // point — palette isn't open yet.
    const panel = page.getByRole('dialog').first();
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/issues\/[a-z0-9]+$/);

    await page.keyboard.press('ControlOrMeta+K');
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await expect(palette).toBeVisible();
    // The contextual "Change status" group only renders when the pathname
    // matches an issue id, so this also pins the path-aware behaviour.
    await expect(palette.getByText(/change status/i)).toBeVisible();

    await page.getByRole('combobox', { name: /command palette/i }).fill('in progress');
    await palette.locator('[cmdk-item][data-value="status in progress"]').click();

    await expect(palette).not.toBeVisible();
    await expect(
      panel.locator('button[aria-label="Status: In progress. Click to change"]')
    ).toBeVisible();
  });

  test('Esc while the palette is over the slide-over closes only the palette', async ({ page }) => {
    const title = `${TEST_PREFIX} palette esc ${Date.now()}`;
    await page.keyboard.press('c');
    await page.getByLabel('New issue title').fill(title);
    await page.getByLabel('New issue title').press('Enter');
    const row = page.locator('li[data-row-index]', { hasText: title }).first();
    await expect(row.locator('a[data-issue-row-id]')).toBeVisible({ timeout: 5_000 });
    await row.locator('a[data-issue-row-id]').click();
    const panel = page.getByRole('dialog').first();
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/issues\/[a-z0-9]+$/);

    await page.keyboard.press('ControlOrMeta+K');
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await expect(palette).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible();
    await expect(panel).toBeVisible();
  });

  test('? opens the palette pre-filtered to the keyboard shortcuts group', async ({ page }) => {
    await page.keyboard.press('?');
    const palette = page.getByRole('dialog', { name: /command palette/i });
    await expect(palette).toBeVisible();
    await expect(page.getByRole('combobox', { name: /command palette/i })).toHaveValue('shortcut');

    // Filtered: only the shortcuts group survives. The navigation "Go to
    // Issues" item is hidden; the shortcuts doc-only "Go to Issues" survives
    // because it matched the search term.
    await expect(
      palette.locator('[cmdk-item][data-value="shortcut open command palette"]')
    ).toBeVisible();
    await expect(palette.locator('[cmdk-item][data-value="go to issues"]')).not.toBeVisible();
  });

  test('axe = 0 violations with the palette open on /issues', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+K');
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
    const axe = await new AxeBuilder({ page }).exclude('[data-nextjs-dev-tools-button]').analyze();
    expect(axe.violations).toEqual([]);
  });
});

/**
 * Same cleanup pattern as M2: hard-delete anything titled `[e2e] ...` from the
 * shared demo workspace via the in-page Convex client. Failures are swallowed
 * so cleanup never masks real assertion failures.
 */
async function purgeE2eIssues(page: Page) {
  await page
    .evaluate(async (prefix) => {
      type ConvexLike = { mutation: (name: string, args: unknown) => Promise<unknown> };
      const client = (window as unknown as { __convex?: ConvexLike }).__convex;
      if (!client) return;
      await client.mutation('issues:purgeByTitlePrefix', { prefix });
    }, TEST_PREFIX)
    .catch(() => {});
}
