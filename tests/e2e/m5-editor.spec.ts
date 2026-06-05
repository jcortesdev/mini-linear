import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

// Prefix sibling to M2 (`[e2e]`), M3 (`[e2e-m3]`), M4 (`[e2e-m4]`),
// M5-presence (`[e2e-m5]`). Distinct to keep parallel afterEach purges safe.
const TEST_PREFIX = '[e2e-m5e]';

/**
 * Drives the M5 Tiptap rich-text editor through:
 *  - Markdown input rules: typing `# ` becomes a heading without the user
 *    ever seeing literal `#` syntax.
 *  - Bubble menu: select text, click Bold, the `<strong>` mark lands.
 *  - Round-trip: save, reload, assert the heading and bold survive a
 *    Convex round-trip (Tiptap → markdown → server → markdown → Tiptap).
 *  - axe = 0 with the panel and editor focused.
 */
test.describe('M5 description editor (Tiptap)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await expect(page.getByRole('heading', { name: /^issues$/i })).toBeVisible({
      timeout: 15_000,
    });
    // IssueCreator's `c` shortcut listener mounts only after the list query
    // resolves. Wait for the first row so `createIssue` doesn't press `c` into
    // a void.
    await expect(page.locator('li[data-row-index="0"]')).toBeVisible({ timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await purgeE2eIssues(page);
  });

  test('markdown input rules, bubble menu, and round-trip across reload', async ({ page }) => {
    const title = `${TEST_PREFIX} editor ${Date.now()}`;
    await createIssue(page, title);
    await openIssue(page, title);

    // Tiptap renders into a contenteditable labelled "Issue description".
    const editor = page.getByLabel('Issue description');
    await expect(editor).toBeVisible();
    await editor.click();

    // Markdown input rule: type `# ` and a heading appears — the literal
    // `#` characters are consumed by ProseMirror's input rule.
    await editor.pressSequentially('# Hello world');
    await expect(editor.locator('h1', { hasText: 'Hello world' })).toBeVisible();

    // Select "Hello" and click Bold from the bubble menu.
    await editor.locator('h1').evaluate((el) => {
      const textNode = el.firstChild;
      if (!textNode) throw new Error('Heading has no text node');
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
    await page.getByRole('button', { name: /^bold$/i }).click();
    await expect(editor.locator('h1 strong', { hasText: 'Hello' })).toBeVisible();

    // Save and reload to prove the markdown round-trip persists.
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled();
    await page.reload();
    await openIssue(page, title);

    const reopened = page.getByLabel('Issue description');
    await expect(reopened.locator('h1', { hasText: 'Hello world' })).toBeVisible();
    await expect(reopened.locator('h1 strong', { hasText: 'Hello' })).toBeVisible();

    // axe with the editor mounted. Tiptap's contenteditable + bubble menu
    // both need to pass.
    const axe = await new AxeBuilder({ page }).exclude('[data-nextjs-dev-tools-button]').analyze();
    expect(axe.violations).toEqual([]);
  });
});

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
