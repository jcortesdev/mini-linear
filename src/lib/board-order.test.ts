import { describe, expect, it, vi } from 'vitest';
import { BOARD_ORDER_GAP, computeInsertOrder } from './board-order';

describe('computeInsertOrder', () => {
  it('seeds at GAP when the column is empty', () => {
    expect(computeInsertOrder({})).toBe(BOARD_ORDER_GAP);
  });

  it('returns half of next when inserting at the top', () => {
    expect(computeInsertOrder({ next: 1000 })).toBe(500);
  });

  it('returns prev + GAP when inserting at the bottom', () => {
    expect(computeInsertOrder({ prev: 3000 })).toBe(3000 + BOARD_ORDER_GAP);
  });

  it('returns the average of neighbours when inserting between two cards', () => {
    expect(computeInsertOrder({ prev: 1000, next: 2000 })).toBe(1500);
  });

  it('keeps splitting the gap on repeated inserts between the same neighbours', () => {
    let lo = 1000;
    const hi = 2000;
    for (let i = 0; i < 5; i++) {
      const next = computeInsertOrder({ prev: lo, next: hi });
      expect(next).toBeGreaterThan(lo);
      expect(next).toBeLessThan(hi);
      lo = next;
    }
  });

  it('warns in dev when the float index converges to a neighbour', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const tiny = 1e-323;
      // Forces avg === prev under IEEE-754: (tiny + (tiny + tiny)) / 2 collapses.
      computeInsertOrder({ prev: tiny, next: tiny });
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
