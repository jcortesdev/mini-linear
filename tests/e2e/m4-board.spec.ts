import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

// Distinct from M2 (`[e2e]`) and M3 (`[e2e-m3]`) so the three suites can run
// in parallel without their afterEach purges racing each other.
const TEST_PREFIX = '[e2e-m4]';

/**
 * Drives the M4 kanban board through:
 *  - the keyboard drag activation path (dnd-kit's KeyboardSensor + live region),
 *  - a mouse drag that persists across a reload (full optimistic + Convex
 *    round-trip pipeline),
 *  - the axe a11y sweep with the board static and with a card picked up.
 *
 * Each test seeds a single `[e2e-m4]` issue on /issues, then navigates to
 * /board. `afterEach` hard-deletes anything prefixed `[e2e-m4]` via the
 * in-page Convex client so the shared demo workspace stays clean.
 */
test.describe('M4 board view + accessible DnD', () => {
  // Anonymous demo users share one workspace; serial keeps row baselines
  // stable across tests, same as M2/M3.
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

  test('keyboard pickup fires the live-region announcement and Esc cancels it', async ({
    page,
  }) => {
    const title = `${TEST_PREFIX} pickup ${Date.now()}`;
    await createIssue(page, title);
    await page.goto('/board');
    await expect(page.getByRole('heading', { name: /^board$/i })).toBeVisible();

    const card = page.locator('[data-issue-card-id]', { hasText: title }).first();
    await expect(card).toBeVisible();

    // useSortable spreads {tabIndex: 0, role: 'button', aria-roledescription:
    // 'sortable'} so the card is focusable and the screen reader announces it
    // as a sortable. `locator.press` dispatches the keydown to the focused
    // element directly — page.keyboard.press goes through the page-level CDP
    // route which doesn't always reach dnd-kit's React onKeyDown listener.
    await card.focus();
    await card.press('Space');

    // useSortable sets `aria-pressed="true"` on the active draggable while a
    // drag is in progress. This is the canonical proof that the KeyboardSensor
    // activated.
    await expect(card).toHaveAttribute('aria-pressed', 'true');

    // dnd-kit's assertive live region holds ONE message at a time and gets
    // overwritten on each lifecycle event. `onDragStart` fires "Picked up..."
    // but `onDragOver` overwrites it instantly because the active card is
    // still over its source slot. The steady-state message we can rely on is
    // either the pickup or the immediately-following "is over column ..."
    const liveDuringDrag = page.locator('[role="status"]').filter({
      hasText: /picked up issue lin-\d+|issue lin-\d+ is over column/i,
    });
    await expect(liveDuringDrag.first()).toBeAttached();

    await card.press('Escape');
    const liveAfterCancel = page.locator('[role="status"]').filter({
      hasText: /movement cancelled/i,
    });
    await expect(liveAfterCancel.first()).toBeAttached();
  });

  test('mouse drag from Backlog to Todo persists across reload', async ({ page }) => {
    const title = `${TEST_PREFIX} persist ${Date.now()}`;
    await createIssue(page, title);
    await page.goto('/board');

    const card = page.locator('[data-issue-card-id]', { hasText: title }).first();
    const backlog = page.locator('section[aria-label^="Backlog column"]').first();
    const todo = page.locator('section[aria-label^="Todo column"]').first();
    await expect(card).toBeVisible();
    await expect(backlog).toContainText(title);

    await dragCardToColumn(page, card, todo);

    // After drop the optimistic patch rewrites the cached list — the card
    // should render under Todo without waiting for the Convex round-trip.
    await expect(todo).toContainText(title);
    await expect(backlog).not.toContainText(title);

    // Hard reload bypasses the in-memory cache. If the boardOrder + status
    // weren't persisted, the card would snap back to Backlog.
    await page.reload();
    await expect(page.getByRole('heading', { name: /^board$/i })).toBeVisible();
    const todoAfter = page.locator('section[aria-label^="Todo column"]').first();
    await expect(todoAfter).toContainText(title);
  });

  test('axe = 0 violations on /board static', async ({ page }) => {
    await page.goto('/board');
    await expect(page.getByRole('heading', { name: /^board$/i })).toBeVisible();
    const axe = await new AxeBuilder({ page }).exclude('[data-nextjs-dev-tools-button]').analyze();
    expect(axe.violations).toEqual([]);
  });

  test('axe = 0 violations on /board with a card picked up', async ({ page }) => {
    const title = `${TEST_PREFIX} axe-pickup ${Date.now()}`;
    await createIssue(page, title);
    await page.goto('/board');

    const card = page.locator('[data-issue-card-id]', { hasText: title }).first();
    await expect(card).toBeVisible();
    await card.focus();
    await card.press('Space');
    await expect(card).toHaveAttribute('aria-pressed', 'true');

    // One axe flag fires only during pickup and isn't a real bug:
    //  - `region` (best-practice, not WCAG): the DragOverlay portal-mounts a
    //    clone on document.body, outside <main>. Inherent to drag overlays.
    //
    // The M5 dashed-border placeholder (see board-card.tsx) removed the
    // color-contrast exclusion that the opacity-ghost approach needed: the
    // placeholder has no text content so axe finds nothing to contrast.
    const axe = await new AxeBuilder({ page })
      .exclude('[data-nextjs-dev-tools-button]')
      .disableRules(['region'])
      .analyze();
    expect(axe.violations).toEqual([]);

    await card.press('Escape');
  });
});

/**
 * Creates a new issue from /issues via the `c` shortcut. Assumes we're already
 * signed in and the `/issues` heading is visible. Returns once the row carrying
 * `title` is rendered with a real (non-optimistic) link target.
 */
async function createIssue(page: Page, title: string) {
  await page.keyboard.press('c');
  await page.getByLabel('New issue title').fill(title);
  await page.getByLabel('New issue title').press('Enter');
  const row = page.locator('li[data-row-index]', { hasText: title }).first();
  await expect(row.locator('a[data-issue-row-id]')).toBeVisible({ timeout: 5_000 });
}

/**
 * Mouse-driven drag of `card` into `column`. dnd-kit's PointerSensor has an
 * 8px activation constraint, so we move the mouse in stepped increments
 * after `mouse.down()` to make sure the drag activates before we travel to
 * the destination column.
 */
async function dragCardToColumn(
  page: Page,
  card: ReturnType<Page['locator']>,
  column: ReturnType<Page['locator']>
) {
  const cardBox = await card.boundingBox();
  const columnBox = await column.boundingBox();
  if (!cardBox || !columnBox) throw new Error('Could not measure card or column for drag.');

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  // Aim for the middle of the column's body, slightly below the header so the
  // pointer lands inside the droppable <ul>, not the <header>.
  const endX = columnBox.x + columnBox.width / 2;
  const endY = columnBox.y + Math.min(columnBox.height - 20, columnBox.height * 0.6);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // First nudge crosses the 8px activation constraint without flying away.
  await page.mouse.move(startX + 12, startY + 4, { steps: 3 });
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.mouse.up();
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
