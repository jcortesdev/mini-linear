/**
 * Pure helpers behind the issues list's roving-tabindex keyboard model.
 * Keeping the math out of the React component lets us pin the behaviour down
 * with unit tests and reuse it for the kanban board when M4 lands.
 */

export type NavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

const NAV_KEYS: ReadonlySet<string> = new Set<NavKey>(['ArrowDown', 'ArrowUp', 'Home', 'End']);

export function isNavKey(key: string): key is NavKey {
  return NAV_KEYS.has(key);
}

/**
 * Returns the next focused index for a keypress, clamped at the list edges
 * (no wrap — matches Linear's behaviour). Returns `null` when:
 * - the key isn't a navigation key,
 * - the list is empty,
 * - or the move would land on the same index (ArrowUp at 0, ArrowDown at last).
 *
 * The null return lets the caller decide whether to swallow the event or let
 * the browser handle it (e.g. ArrowDown at the bottom should scroll the page).
 */
export function getNextRowIndex(currentIndex: number, key: string, total: number): number | null {
  if (total <= 0) return null;
  if (!isNavKey(key)) return null;

  const clampedCurrent = Math.max(-1, Math.min(currentIndex, total - 1));

  switch (key) {
    case 'ArrowDown': {
      const next = clampedCurrent + 1;
      return next >= total ? null : next;
    }
    case 'ArrowUp': {
      const next = clampedCurrent - 1;
      return next < 0 ? null : next;
    }
    case 'Home':
      return clampedCurrent === 0 ? null : 0;
    case 'End':
      return clampedCurrent === total - 1 ? null : total - 1;
  }
}
