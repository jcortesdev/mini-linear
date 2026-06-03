'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onSave: (next: string) => Promise<unknown> | unknown;
  /**
   * Class applied to both the display and editing element so the row layout
   * stays identical between modes.
   */
  className?: string;
  ariaLabel?: string;
  /**
   * Rendered when not editing. Default is a `<span>` with the value. Override
   * when you need a heading element (e.g. `<h1>` in the detail panel).
   */
  renderDisplay?: (value: string, onActivate: () => void) => React.ReactNode;
  maxLength?: number;
};

const DEFAULT_MAX = 200;

/**
 * Click-to-edit title used by the list row and the detail panel. Enter saves,
 * Escape reverts. Empty submissions revert to the original value rather than
 * surface a validation error inline — keeps the UX tight, server-side
 * validation still rejects empty payloads.
 */
export function InlineEditableTitle({
  value,
  onSave,
  className,
  ariaLabel,
  renderDisplay,
  maxLength = DEFAULT_MAX,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function activate() {
    setDraft(value);
    setEditing(true);
  }

  function revert() {
    setDraft(value);
    setEditing(false);
  }

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value.trim()) {
      revert();
      return;
    }
    setPending(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      // Server-side rejection — revert to the previous value rather than leave
      // the user staring at unsaved text. Higher-level toasts can surface why.
      revert();
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            revert();
          }
        }}
        aria-label={ariaLabel ?? 'Edit title'}
        maxLength={maxLength}
        disabled={pending}
        className={`${className ?? ''} w-full bg-transparent outline-none ring-1 ring-zinc-300 dark:ring-zinc-700`}
      />
    );
  }

  if (renderDisplay) {
    return <>{renderDisplay(value, activate)}</>;
  }

  return (
    <button
      type="button"
      data-edit-title
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        activate();
      }}
      aria-label={ariaLabel}
      className={`${className ?? ''} cursor-text text-left`}
    >
      {value}
    </button>
  );
}
