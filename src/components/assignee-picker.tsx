'use client';

import { getInitials } from '@/lib/issue-meta';
import { useUpdateIssue } from '@/lib/issue-mutations';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ChevronDown } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Avatar } from './avatar';
import { type Option, OptionsPopover } from './options-popover';

const UNASSIGNED = '__unassigned__' as const;
type PickerValue = Id<'users'> | typeof UNASSIGNED;

type Assignee = FunctionReturnType<typeof api.issues.list>[number]['assignee'];

type Props = {
  issueId: Id<'issues'>;
  assignee: Assignee;
  variant?: 'icon' | 'inline';
};

export function AssigneePicker({ issueId, assignee, variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const members = useQuery(api.members.list);

  const update = useUpdateIssue();

  const options = useMemo<Option<PickerValue>[]>(() => {
    const memberOptions: Option<PickerValue>[] = (members ?? []).map((m) => {
      const display = m.name ?? m.email ?? 'Member';
      return {
        value: m._id,
        label: display,
        icon: <Avatar initials={getInitials(display)} image={m.image} />,
      };
    });
    return [
      {
        value: UNASSIGNED,
        label: 'Unassigned',
        icon: <Avatar dashed />,
      },
      ...memberOptions,
    ];
  }, [members]);

  const display = assignee ? (assignee.name ?? assignee.email ?? 'Member') : 'Unassigned';

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
        aria-label={`Assignee: ${display}. Click to change`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={display}
        className={
          variant === 'inline'
            ? 'flex items-center gap-2 rounded px-2 py-1 text-sm transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900'
            : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:ring-2 hover:ring-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:ring-zinc-700'
        }
      >
        {assignee ? (
          <Avatar initials={getInitials(display)} image={assignee.image} />
        ) : (
          <Avatar dashed />
        )}
        {variant === 'inline' && (
          <>
            <span className={assignee ? '' : 'text-zinc-500'}>{display}</span>
            <ChevronDown aria-hidden="true" className="h-3 w-3 text-zinc-400" />
          </>
        )}
      </button>
      <OptionsPopover
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        options={options}
        value={assignee?._id ?? UNASSIGNED}
        onSelect={(next) => {
          const nextId = next === UNASSIGNED ? null : next;
          const currentId = assignee?._id ?? null;
          if (nextId !== currentId) {
            update({ id: issueId, assigneeId: nextId }).catch(() => {});
          }
        }}
        label="Change assignee"
      />
    </>
  );
}
