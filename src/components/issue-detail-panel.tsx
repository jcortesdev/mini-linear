'use client';

import { getInitials } from '@/lib/issue-meta';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { AssigneePicker } from './assignee-picker';
import { DescriptionEditor } from './description-editor';
import { InlineEditableTitle } from './inline-editable-title';
import { LabelsPicker } from './labels-picker';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';
import { useToast } from './toast-provider';

type Issue = NonNullable<FunctionReturnType<typeof api.issues.get>>;

type Props = {
  id: Id<'issues'>;
  onClose: () => void;
  /** Pass `true` when the panel is rendered inline as a full route (no close button). */
  fullPage?: boolean;
};

export function IssueDetailPanel({ id, onClose, fullPage = false }: Props) {
  const issue = useQuery(api.issues.get, { id });
  const { toast } = useToast();
  const update = useMutation(api.issues.update).withOptimisticUpdate((localStore, args) => {
    if (args.title === undefined) return;
    const detail = localStore.getQuery(api.issues.get, { id: args.id });
    if (detail) {
      localStore.setQuery(api.issues.get, { id: args.id }, { ...detail, title: args.title });
    }
    const list = localStore.getQuery(api.issues.list, {});
    if (list) {
      localStore.setQuery(
        api.issues.list,
        {},
        list.map((i) => (i._id === args.id ? { ...i, title: args.title as string } : i))
      );
    }
  });

  const remove = useMutation(api.issues.remove).withOptimisticUpdate((localStore, args) => {
    const list = localStore.getQuery(api.issues.list, {});
    if (list) {
      localStore.setQuery(
        api.issues.list,
        {},
        list.filter((i) => i._id !== args.id)
      );
    }
  });
  const restore = useMutation(api.issues.restore);

  async function handleDelete() {
    if (!issue) return;
    const snapshot = { id: issue._id, number: issue.number };
    onClose();
    try {
      await remove({ id: snapshot.id });
      toast({
        title: `LIN-${snapshot.number} deleted.`,
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: () => {
            restore({ id: snapshot.id }).catch(() => {
              toast({ title: 'Could not restore issue.', variant: 'error' });
            });
          },
        },
      });
    } catch {
      toast({ title: 'Could not delete issue.', variant: 'error' });
    }
  }

  if (issue === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading…</div>
    );
  }

  if (issue === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-zinc-500">Issue not found.</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header issue={issue} onClose={onClose} onDelete={handleDelete} fullPage={fullPage} />
      <div className="flex-1 overflow-auto px-6 py-5">
        <h1 id="issue-detail-title" className="text-xl font-semibold leading-snug">
          <InlineEditableTitle
            value={issue.title}
            onSave={(next) => update({ id: issue._id, title: next })}
            ariaLabel="Edit issue title"
            className="w-full rounded text-xl font-semibold leading-snug hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900"
          />
        </h1>

        <Metadata issue={issue} />

        <section aria-labelledby="issue-description-heading" className="mt-6">
          <DescriptionEditor issueId={issue._id} initialValue={issue.description} />
        </section>
      </div>
    </div>
  );
}

function Header({
  issue,
  onClose,
  onDelete,
  fullPage,
}: {
  issue: Issue;
  onClose: () => void;
  onDelete: () => void;
  fullPage: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!fullPage) closeRef.current?.focus();
  }, [fullPage]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
      <span className="font-mono text-xs text-zinc-500">LIN-{issue.number}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete issue"
          className="rounded p-1 text-zinc-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
        {!fullPage && (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close issue"
            className="rounded p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}

function Metadata({ issue }: { issue: Issue }) {
  return (
    <dl className="mt-5 grid grid-cols-[80px_1fr] items-center gap-x-4 gap-y-1 text-sm">
      <Term>Status</Term>
      <Detail>
        <StatusPicker issueId={issue._id} status={issue.status} variant="inline" />
      </Detail>

      <Term>Priority</Term>
      <Detail>
        <PriorityPicker issueId={issue._id} priority={issue.priority} variant="inline" />
      </Detail>

      <Term>Assignee</Term>
      <Detail>
        <AssigneePicker issueId={issue._id} assignee={issue.assignee} variant="inline" />
      </Detail>

      <Term>Creator</Term>
      <Detail>
        <PersonChip person={issue.creator} fallback="Unknown" />
      </Detail>

      <Term>Labels</Term>
      <Detail>
        <div className="flex flex-wrap items-center gap-1.5 py-1">
          {issue.labels.map((label) => (
            <span
              key={label._id}
              className="flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
          <LabelsPicker issueId={issue._id} selected={issue.labels} />
        </div>
      </Detail>
    </dl>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{children}</dt>;
}

function Detail({ children }: { children: React.ReactNode }) {
  return <dd className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">{children}</dd>;
}

function PersonChip({
  person,
  fallback,
}: {
  person: Issue['assignee'];
  fallback: string;
}) {
  if (!person) {
    return <span className="px-2 text-zinc-400">{fallback}</span>;
  }
  const display = person.name ?? person.email ?? 'Member';
  return (
    <span className="flex items-center gap-2 px-2 py-1">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {getInitials(display)}
      </span>
      <span>{display}</span>
    </span>
  );
}
