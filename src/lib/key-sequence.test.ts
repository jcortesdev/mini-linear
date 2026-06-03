import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type KeyEventLike, createKeySequenceMatcher } from './key-sequence';

function press(
  key: string,
  modifiers: Partial<Pick<KeyEventLike, 'metaKey' | 'ctrlKey' | 'altKey'>> = {}
) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...modifiers,
    preventDefault: vi.fn<() => void>(),
  };
}

describe('createKeySequenceMatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onMatch once both keys arrive in order', () => {
    const onMatch = vi.fn();
    const m = createKeySequenceMatcher({ sequences: [{ keys: ['g', 'i'], onMatch }] });

    const g = press('g');
    m.handleKeyDown(g);
    expect(onMatch).not.toHaveBeenCalled();
    expect(g.preventDefault).not.toHaveBeenCalled();

    const i = press('i');
    m.handleKeyDown(i);
    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(i.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('routes the right match across multiple sequences sharing a prefix', () => {
    const onIssues = vi.fn();
    const onBoard = vi.fn();
    const m = createKeySequenceMatcher({
      sequences: [
        { keys: ['g', 'i'], onMatch: onIssues },
        { keys: ['g', 'b'], onMatch: onBoard },
      ],
    });

    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('b'));
    expect(onBoard).toHaveBeenCalledTimes(1);
    expect(onIssues).not.toHaveBeenCalled();

    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('i'));
    expect(onIssues).toHaveBeenCalledTimes(1);
  });

  it('completes single-key sequences immediately', () => {
    const onHelp = vi.fn();
    const m = createKeySequenceMatcher({ sequences: [{ keys: ['?'], onMatch: onHelp }] });

    const ev = press('?');
    m.handleKeyDown(ev);
    expect(onHelp).toHaveBeenCalledTimes(1);
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it('clears the buffer after the timeout', () => {
    const onMatch = vi.fn();
    const m = createKeySequenceMatcher({
      sequences: [{ keys: ['g', 'i'], onMatch }],
      timeoutMs: 500,
    });

    m.handleKeyDown(press('g'));
    vi.advanceTimersByTime(501);
    m.handleKeyDown(press('i'));
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('ignores events when any modifier is held', () => {
    const onMatch = vi.fn();
    const m = createKeySequenceMatcher({ sequences: [{ keys: ['g', 'i'], onMatch }] });

    m.handleKeyDown(press('g', { metaKey: true }));
    m.handleKeyDown(press('i'));
    // 'i' alone is not a sequence start, so still no match.
    expect(onMatch).not.toHaveBeenCalled();

    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('i', { ctrlKey: true }));
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('honours shouldSkip without mutating the buffer', () => {
    const onMatch = vi.fn();
    const m = createKeySequenceMatcher({
      sequences: [{ keys: ['g', 'i'], onMatch }],
      shouldSkip: (e) => e.key === 'i', // pretend an editable target eats the i
    });

    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('i')); // skipped
    expect(onMatch).not.toHaveBeenCalled();

    // Buffer should still hold the `g`, so a follow-up i (not skipped here)
    // would have matched — but since shouldSkip is stable, this confirms the
    // skipped event left no trace.
    m.handleKeyDown(press('x')); // not part of any sequence → resets
    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('i')); // still skipped
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('skips non-printable keys so Shift/Enter/Tab cannot poison the buffer', () => {
    const onMatch = vi.fn();
    const m = createKeySequenceMatcher({ sequences: [{ keys: ['g', 'i'], onMatch }] });

    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('Shift'));
    m.handleKeyDown(press('Enter'));
    m.handleKeyDown(press('i'));
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('restarts the buffer when a mismatched key could begin a new sequence', () => {
    const onMatch = vi.fn();
    const m = createKeySequenceMatcher({ sequences: [{ keys: ['g', 'i'], onMatch }] });

    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('x')); // breaks the pending g-prefix
    m.handleKeyDown(press('g'));
    m.handleKeyDown(press('i'));
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('reset() clears any pending buffer', () => {
    const onMatch = vi.fn();
    const m = createKeySequenceMatcher({ sequences: [{ keys: ['g', 'i'], onMatch }] });

    m.handleKeyDown(press('g'));
    m.reset();
    m.handleKeyDown(press('i'));
    expect(onMatch).not.toHaveBeenCalled();
  });
});
