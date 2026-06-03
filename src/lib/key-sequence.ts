/**
 * Recognises multi-key keyboard "leader" shortcuts (e.g. `g i`, `g b`) on top
 * of a single keydown stream. Kept dependency-free and DOM-agnostic so it
 * unit-tests with plain objects and reuses cleanly outside the palette
 * provider (e.g. board view in M4).
 */

export type KeyEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
};

export type KeySequence = {
  /** Ordered keys that must arrive within `timeoutMs` of each other. */
  keys: readonly string[];
  /** Fired with `preventDefault` already called on the completing event. */
  onMatch: () => void;
};

export type KeySequenceMatcher = {
  handleKeyDown: (event: KeyEventLike) => void;
  reset: () => void;
};

type CreateOptions = {
  sequences: readonly KeySequence[];
  /** Default 900ms — long enough to type `g i` deliberately, short enough to feel snappy. */
  timeoutMs?: number;
  /**
   * Return true to ignore the event entirely (no buffer mutation, no match).
   * Use to skip events while the user is typing in a form field or while a
   * higher-priority surface (the palette itself) owns the keyboard.
   */
  shouldSkip?: (event: KeyEventLike) => boolean;
};

export function createKeySequenceMatcher({
  sequences,
  timeoutMs = 900,
  shouldSkip,
}: CreateOptions): KeySequenceMatcher {
  let buffer: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function reset() {
    buffer = [];
    clearTimer();
  }

  function scheduleReset() {
    clearTimer();
    timer = setTimeout(() => {
      buffer = [];
      timer = null;
    }, timeoutMs);
  }

  function handleKeyDown(event: KeyEventLike) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (shouldSkip?.(event)) return;
    // Skip non-printable / multi-char keys so Shift/Tab/Enter never poison the buffer.
    if (event.key.length !== 1) return;

    const next = [...buffer, event.key];

    const completed = sequences.find((s) => arraysEqual(s.keys, next));
    if (completed) {
      reset();
      event.preventDefault();
      completed.onMatch();
      return;
    }

    const continues = sequences.some((s) => isPrefix(next, s.keys));
    if (continues) {
      buffer = next;
      scheduleReset();
      return;
    }

    // Mismatch — start fresh if the key could begin some sequence, else clear.
    const restarts = sequences.some((s) => s.keys[0] === event.key);
    if (restarts) {
      buffer = [event.key];
      // A single-key sequence (e.g. `?`) completes immediately.
      const single = sequences.find((s) => arraysEqual(s.keys, buffer));
      if (single) {
        reset();
        event.preventDefault();
        single.onMatch();
        return;
      }
      scheduleReset();
    } else {
      reset();
    }
  }

  return { handleKeyDown, reset };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isPrefix(prefix: readonly string[], full: readonly string[]): boolean {
  if (prefix.length >= full.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== full[i]) return false;
  }
  return true;
}
