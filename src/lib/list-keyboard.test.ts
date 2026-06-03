import { describe, expect, it } from 'vitest';
import { getNextRowIndex, isNavKey } from './list-keyboard';

describe('isNavKey', () => {
  it('recognises the four navigation keys', () => {
    expect(isNavKey('ArrowUp')).toBe(true);
    expect(isNavKey('ArrowDown')).toBe(true);
    expect(isNavKey('Home')).toBe(true);
    expect(isNavKey('End')).toBe(true);
  });

  it('rejects other keys', () => {
    expect(isNavKey('Enter')).toBe(false);
    expect(isNavKey('a')).toBe(false);
    expect(isNavKey('Tab')).toBe(false);
    expect(isNavKey('')).toBe(false);
  });
});

describe('getNextRowIndex', () => {
  it('returns null for non-navigation keys', () => {
    expect(getNextRowIndex(0, 'Enter', 5)).toBeNull();
    expect(getNextRowIndex(2, 'e', 5)).toBeNull();
  });

  it('returns null on an empty list', () => {
    expect(getNextRowIndex(0, 'ArrowDown', 0)).toBeNull();
    expect(getNextRowIndex(-1, 'Home', 0)).toBeNull();
  });

  describe('ArrowDown', () => {
    it('moves focus down by one', () => {
      expect(getNextRowIndex(0, 'ArrowDown', 5)).toBe(1);
      expect(getNextRowIndex(3, 'ArrowDown', 5)).toBe(4);
    });

    it('clamps at the last row instead of wrapping', () => {
      expect(getNextRowIndex(4, 'ArrowDown', 5)).toBeNull();
    });

    it('moves from the unfocused state (-1) onto the first row', () => {
      expect(getNextRowIndex(-1, 'ArrowDown', 5)).toBe(0);
    });
  });

  describe('ArrowUp', () => {
    it('moves focus up by one', () => {
      expect(getNextRowIndex(4, 'ArrowUp', 5)).toBe(3);
      expect(getNextRowIndex(1, 'ArrowUp', 5)).toBe(0);
    });

    it('clamps at the first row instead of wrapping', () => {
      expect(getNextRowIndex(0, 'ArrowUp', 5)).toBeNull();
    });
  });

  describe('Home and End', () => {
    it('jumps to the first row', () => {
      expect(getNextRowIndex(3, 'Home', 5)).toBe(0);
    });

    it('jumps to the last row', () => {
      expect(getNextRowIndex(1, 'End', 5)).toBe(4);
    });

    it('returns null when already at the target edge', () => {
      expect(getNextRowIndex(0, 'Home', 5)).toBeNull();
      expect(getNextRowIndex(4, 'End', 5)).toBeNull();
    });
  });

  it('treats out-of-range currentIndex as clamped before computing', () => {
    // Defensive: if the caller's index briefly outruns the list (e.g. after a
    // delete), we should still move sanely instead of crashing.
    expect(getNextRowIndex(99, 'ArrowUp', 5)).toBe(3);
    expect(getNextRowIndex(99, 'ArrowDown', 5)).toBeNull();
    expect(getNextRowIndex(-5, 'ArrowDown', 5)).toBe(0);
  });
});
