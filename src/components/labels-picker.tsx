'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Tag } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type IssueLabels = FunctionReturnType<typeof api.issues.list>[number]['labels'];

type Props = {
  issueId: Id<'issues'>;
  selected: IssueLabels;
};

/**
 * Multi-select labels popover. Bespoke instead of generalising OptionsPopover
 * because the keyboard model differs: Space/Enter TOGGLES the highlighted
 * label (does not close), Escape closes.
 */
export function LabelsPicker({ issueId, selected }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labels = useQuery(api.labels.list);

  const selectedIds = new Set(selected.map((l) => l._id));

  const update = useMutation(api.issues.update).withOptimisticUpdate((localStore, args) => {
    if (args.labelIds === undefined) return;
    const cached = localStore.getQuery(api.labels.list, {});
    if (!cached) return;
    const nextLabels = args.labelIds
      .map((id) => cached.find((l) => l._id === id))
      .filter((l): l is NonNullable<typeof l> => l !== undefined)
      .map((l) => ({ _id: l._id, name: l.name, color: l.color }));

    const list = localStore.getQuery(api.issues.list, {});
    if (list) {
      localStore.setQuery(
        api.issues.list,
        {},
        list.map((i) => (i._id === args.id ? { ...i, labels: nextLabels } : i))
      );
    }
    const detail = localStore.getQuery(api.issues.get, { id: args.id });
    if (detail) {
      localStore.setQuery(api.issues.get, { id: args.id }, { ...detail, labels: nextLabels });
    }
  });

  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedWidth = listRef.current?.offsetWidth ?? 220;
    const margin = 8;
    const overflowRight = rect.left + estimatedWidth + margin - window.innerWidth;
    const left = overflowRight > 0 ? Math.max(margin, rect.left - overflowRight) : rect.left;
    setPosition({ top: rect.bottom + 4, left });
  }, [open]);

  useEffect(() => {
    if (open && position) listRef.current?.focus();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (listRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function toggle(labelId: Id<'labels'>) {
    const next = new Set(selectedIds);
    if (next.has(labelId)) next.delete(labelId);
    else next.add(labelId);
    update({ id: issueId, labelIds: Array.from(next) }).catch(() => {});
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!labels) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % labels.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + labels.length) % labels.length);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const label = labels[activeIndex];
      if (label) toggle(label._id);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Labels: ${selected.length}. Click to change`}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
      >
        <Tag aria-hidden="true" className="h-3 w-3" />
        {selected.length === 0
          ? 'Add label'
          : `${selected.length} label${selected.length === 1 ? '' : 's'}`}
      </button>

      {open &&
        position !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Labels"
            aria-multiselectable
            aria-activedescendant={
              labels?.[activeIndex] ? `${listboxId}-${activeIndex}` : undefined
            }
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 max-h-72 min-w-[200px] overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg outline-none dark:border-zinc-800 dark:bg-zinc-950"
          >
            {labels === undefined && <p className="px-3 py-1.5 text-zinc-500">Loading…</p>}
            {labels !== undefined && labels.length === 0 && (
              <p className="px-3 py-1.5 text-zinc-500">No labels in this workspace.</p>
            )}
            {labels?.map((label, index) => {
              const isSelected = selectedIds.has(label._id);
              const isActive = index === activeIndex;
              return (
                <div
                  key={label._id}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => toggle(label._id)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${
                    isActive ? 'bg-zinc-100 dark:bg-zinc-900' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 truncate">{label.name}</span>
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
        )}
    </>
  );
}
