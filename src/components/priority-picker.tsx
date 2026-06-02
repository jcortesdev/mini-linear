'use client';

import { type IssuePriority, PRIORITY_META } from '@/lib/issue-meta';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { type Option, OptionsPopover } from './options-popover';

const PRIORITY_OPTIONS: Option<IssuePriority>[] = (
  Object.entries(PRIORITY_META) as [IssuePriority, (typeof PRIORITY_META)[IssuePriority]][]
).map(([value, meta]) => {
  const Icon = meta.icon;
  return {
    value,
    label: meta.label,
    icon: <Icon aria-hidden="true" className={`h-4 w-4 ${meta.iconClass}`} />,
  };
});

type Props = {
  issueId: Id<'issues'>;
  priority: IssuePriority;
  variant?: 'icon' | 'inline';
};

export function PriorityPicker({ issueId, priority, variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const update = useMutation(api.issues.update).withOptimisticUpdate((localStore, args) => {
    if (args.priority === undefined) return;
    const list = localStore.getQuery(api.issues.list, {});
    if (list) {
      localStore.setQuery(
        api.issues.list,
        {},
        list.map((i) =>
          i._id === args.id ? { ...i, priority: args.priority as IssuePriority } : i
        )
      );
    }
    const detail = localStore.getQuery(api.issues.get, { id: args.id });
    if (detail) {
      localStore.setQuery(api.issues.get, { id: args.id }, { ...detail, priority: args.priority });
    }
  });

  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;

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
        aria-label={`Priority: ${meta.label}. Click to change`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          variant === 'inline'
            ? 'flex items-center gap-2 rounded px-2 py-1 text-sm transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900'
            : 'flex h-6 w-6 shrink-0 items-center justify-center rounded transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-800'
        }
      >
        <Icon aria-hidden="true" className={`h-4 w-4 ${meta.iconClass}`} />
        {variant === 'inline' && <span>{meta.label}</span>}
      </button>
      <OptionsPopover
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        options={PRIORITY_OPTIONS}
        value={priority}
        onSelect={(next) => {
          if (next !== priority) {
            update({ id: issueId, priority: next }).catch(() => {});
          }
        }}
        label="Change priority"
      />
    </>
  );
}
