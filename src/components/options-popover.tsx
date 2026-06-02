'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Option<TValue extends string> = {
  value: TValue;
  label: string;
  icon?: React.ReactNode;
  description?: string;
};

type Props<TValue extends string> = {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  options: Option<TValue>[];
  value: TValue | null;
  onSelect: (value: TValue) => void;
  label: string;
};

/**
 * Generic single-select popover anchored to a trigger button. Renders an ARIA
 * listbox in a portal so it escapes any `overflow:hidden` ancestor. Keyboard
 * model: ↑/↓ move highlight, Home/End jump to ends, Enter commits, Escape
 * cancels and returns focus to the trigger.
 */
export function OptionsPopover<TValue extends string>({
  anchorRef,
  open,
  onClose,
  options,
  value,
  onSelect,
  label,
}: Props<TValue>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(() => {
    const i = options.findIndex((o) => o.value === value);
    return i === -1 ? 0 : i;
  });
  const listboxId = useId();

  // Reset highlight to the current value each time the popover opens.
  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActiveIndex(i === -1 ? 0 : i);
    }
  }, [open, options, value]);

  // Position the popover under the anchor — measured synchronously after the
  // anchor and the list both exist, before the browser paints.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  }, [open, anchorRef]);

  // Move keyboard focus into the list so arrow keys work without the user
  // having to Tab in first. Depends on `position` because the listbox is only
  // rendered once positioning has been measured — focusing earlier would no-op.
  useEffect(() => {
    if (open && position) listRef.current?.focus();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (listRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose, anchorRef]);

  if (!open || position === null) return null;
  if (typeof document === 'undefined') return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      anchorRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) {
        onSelect(option.value);
        onClose();
        anchorRef.current?.focus();
      }
    }
  }

  return createPortal(
    <div
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${listboxId}-option-${activeIndex}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{ top: position.top, left: position.left }}
      className="fixed z-50 max-h-72 min-w-[200px] overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg outline-none dark:border-zinc-800 dark:bg-zinc-950"
    >
      {options.map((option, index) => {
        const isActive = index === activeIndex;
        const isSelected = option.value === value;
        return (
          <div
            key={option.value}
            id={`${listboxId}-option-${index}`}
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => {
              onSelect(option.value);
              onClose();
              anchorRef.current?.focus();
            }}
            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${
              isActive ? 'bg-zinc-100 dark:bg-zinc-900' : ''
            } ${isSelected ? 'font-medium' : ''}`}
          >
            {option.icon && (
              <span className="flex h-4 w-4 shrink-0 items-center">{option.icon}</span>
            )}
            <span className="flex-1 truncate">{option.label}</span>
            {isSelected && (
              <span aria-hidden="true" className="text-xs text-zinc-400">
                ✓
              </span>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
