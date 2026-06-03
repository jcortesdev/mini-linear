'use client';

import { type IssueStatus, STATUS_META } from '@/lib/issue-meta';
import { useUpdateIssue } from '@/lib/issue-mutations';
import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Id } from '../../convex/_generated/dataModel';
import { type Option, OptionsPopover } from './options-popover';

const STATUS_OPTIONS: Option<IssueStatus>[] = (
  Object.entries(STATUS_META) as [IssueStatus, (typeof STATUS_META)[IssueStatus]][]
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
  status: IssueStatus;
  variant?: 'icon' | 'inline';
};

export function StatusPicker({ issueId, status, variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const update = useUpdateIssue();

  const meta = STATUS_META[status];
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
        aria-label={`Status: ${meta.label}. Click to change`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          variant === 'inline'
            ? 'flex items-center gap-2 rounded px-2 py-1 text-sm transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900'
            : 'flex h-6 w-6 shrink-0 items-center justify-center rounded transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-800'
        }
      >
        <Icon aria-hidden="true" className={`h-4 w-4 ${meta.iconClass}`} />
        {variant === 'inline' && (
          <>
            <span>{meta.label}</span>
            <ChevronDown aria-hidden="true" className="h-3 w-3 text-zinc-400" />
          </>
        )}
      </button>
      <OptionsPopover
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        options={STATUS_OPTIONS}
        value={status}
        onSelect={(next) => {
          if (next !== status) {
            update({ id: issueId, status: next }).catch(() => {
              // Convex rolls back the optimistic update automatically. Silent
              // failure here is fine for M2 — the toast system lands in task 7.
            });
          }
        }}
        label="Change status"
      />
    </>
  );
}
