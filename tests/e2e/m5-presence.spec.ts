import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

// Distinct from M2 (`[e2e]`), M3 (`[e2e-m3]`) and M4 (`[e2e-m4]`) so the suites
// can run in parallel without their afterEach purges racing each other.
const TEST_PREFIX = '[e2e-m5]';

/**
 * Drives the M5 presence feature:
 *  - Two browser contexts = two demo users. Context A opens an issue, then
 *    context B opens the same issue, and we assert context A's panel header
 *    surfaces the second viewer's avatar within the heartbeat staleness
 *    window (10s tick + 30s server-side window).
 *  - axe = 0 on the panel with presence rendered.
 */
test.describe('M5 presence', () => {
  // Two contexts isolate cookies but still share the demo workspace, so
  // serial keeps row baselines deterministic across tests.
  test.describe.configure({ mode: 'serial' });

  test('a second tab on the same issue surfaces a presence avatar', async ({ browser }) => {
    const title = `${TEST_PREFIX} presence ${Date.now()}`;

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await signInAsDemo(pageA);
      await createIssue(pageA, title);
      await openIssue(pageA, title);

      // Panel header lands; presence list starts empty because B isn't here.
      const headerA = pageA.getByRole('dialog').filter({ hasText: title }).first();
      await expect(headerA).toBeVisible();
      await expect(headerA.locator('[role="group"][aria-label*="viewing"]')).toHaveCount(0);

      await signInAsDemo(pageB);
      await openIssue(pageB, title);

      // A's heartbeat ticks every 10s; B's heartbeat fires on mount so the
      // server query result invalidates for A within ~one Convex tick.
      await expect(headerA.locator('[role="group"][aria-label*="viewing"]')).toBeVisible({
        timeout: 15_000,
      });
      const groupA = headerA.locator('[role="group"][aria-label*="viewing"]');
      await expect(groupA).toHaveAttribute('aria-label', /1 other person viewing/i);

      // axe with the presence avatar rendered.
      const axe = await new AxeBuilder({ page: pageA })
        .exclude('[data-nextjs-dev-tools-button]')
        .analyze();
      expect(axe.violations).toEqual([]);
    } finally {
      await purgeE2eIssues(pageA);
      await contextA.close();
      await contextB.close();
    }
  });
});

async function signInAsDemo(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: /try the demo/i }).click();
  await expect(page.getByRole('heading', { name: /^issues$/i })).toBeVisible({ timeout: 15_000 });
  // The list query must resolve before IssueCreator's `c` listener mounts.
  await expect(page.locator('li[data-row-index="0"]')).toBeVisible({ timeout: 10_000 });
}

async function createIssue(page: Page, title: string) {
  await page.keyboard.press('c');
  await page.getByLabel('New issue title').fill(title);
  await page.getByLabel('New issue title').press('Enter');
  const row = page.locator('li[data-row-index]', { hasText: title }).first();
  await expect(row.locator('a[data-issue-row-id]')).toBeVisible({ timeout: 5_000 });
}

async function openIssue(page: Page, title: string) {
  const row = page.locator('li[data-row-index]', { hasText: title }).first();
  await row.locator('a[data-issue-row-id]').click();
  await expect(page.getByRole('dialog').filter({ hasText: title }).first()).toBeVisible();
}

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
