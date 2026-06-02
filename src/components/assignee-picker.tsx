'use client';

import { getInitials } from '@/lib/issue-meta';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useMemo, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
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

  const update = useMutation(api.issues.update).withOptimisticUpdate((localStore, args) => {
    if (args.assigneeId === undefined) return;
    const cachedMembers = localStore.getQuery(api.members.list, {});
    const nextAssignee: Assignee =
      args.assigneeId === null
        ? null
        : (cachedMembers?.find((m) => m._id === args.assigneeId) ?? null);

    const list = localStore.getQuery(api.issues.list, {});
    if (list) {
      localStore.setQuery(
        api.issues.list,
        {},
        list.map((i) => (i._id === args.id ? { ...i, assignee: nextAssignee } : i))
      );
    }
    const detail = localStore.getQuery(api.issues.get, { id: args.id });
    if (detail) {
      localStore.setQuery(api.issues.get, { id: args.id }, { ...detail, assignee: nextAssignee });
    }
  });

  const options = useMemo<Option<PickerValue>[]>(() => {
    const memberOptions: Option<PickerValue>[] = (members ?? []).map((m) => {
      const display = m.name ?? m.email ?? 'Member';
      return {
        value: m._id,
        label: display,
        icon: <Avatar initials={getInitials(display)} />,
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
        {assignee ? <Avatar initials={getInitials(display)} /> : <Avatar dashed />}
        {variant === 'inline' && <span className={assignee ? '' : 'text-zinc-400'}>{display}</span>}
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

function Avatar({ initials, dashed = false }: { initials?: string; dashed?: boolean }) {
  if (dashed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-zinc-300 text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
      >
        ·
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      {initials}
    </span>
  );
}
