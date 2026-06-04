/**
 * Float-index ordering for the kanban board. Each issue keeps a `boardOrder`
 * number; the column sorts ascending and inserts at the average of the two
 * neighbours so reordering only ever rewrites one row.
 *
 * Edge cases:
 *  - No neighbours (empty column or first ever insert): seed at `GAP`.
 *  - Only `next` (insert at top): half of `next`.
 *  - Only `prev` (insert at bottom): `prev + GAP`.
 *  - Both: average. The seed step uses `GAP = 1000`, so after ~50 inserts
 *    into the same exact slot the gap collapses to indistinguishable floats.
 *    A dev-only warn fires in that case; carry-over to M5 is a rebalance
 *    admin mutation.
 */

export const BOARD_ORDER_GAP = 1000;

export function computeInsertOrder({
  prev,
  next,
}: {
  prev?: number;
  next?: number;
}): number {
  if (prev === undefined && next === undefined) return BOARD_ORDER_GAP;
  if (prev === undefined) return (next as number) / 2;
  if (next === undefined) return prev + BOARD_ORDER_GAP;
  const avg = (prev + next) / 2;
  if (process.env.NODE_ENV !== 'production' && (avg === prev || avg === next)) {
    console.warn(
      `[board-order] float index converged at ${avg} (prev=${prev}, next=${next}). Consider rebalancing the column.`
    );
  }
  return avg;
}
