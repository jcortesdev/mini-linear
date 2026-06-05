'use client';

import { getInitials } from '@/lib/issue-meta';
import { useRemoveIssue, useUpdateIssue } from '@/lib/issue-mutations';
import { usePresenceHeartbeat } from '@/lib/use-presence-heartbeat';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Trash2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { AssigneePicker } from './assignee-picker';
import { Avatar } from './avatar';
import { InlineEditableTitle } from './inline-editable-title';
import { LabelsPicker } from './labels-picker';
import { PresenceViewers } from './presence-viewers';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';
import { useToast } from './toast-provider';

// Tiptap brings ~85 kB gzipped — load it only when a detail panel actually
// mounts so the /issues list bundle stays lean. SSR off because Tiptap
// initialises ProseMirror with a browser DOM reference.
const DescriptionEditor = dynamic(
  () => import('./description-editor-tiptap').then((m) => m.DescriptionEditor),
  {
    ssr: false,
    // The skeleton is purely visual — `aria-hidden` keeps it out of the a11y
    // tree (an `aria-label` on a bare <div> trips axe's aria-prohibited-attr
    // rule since the element has no role).
    loading: () => (
      <div
        aria-hidden="true"
        className="min-h-[6rem] animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900"
      />
    ),
  }
);

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
  const update = useUpdateIssue();
  const remove = useRemoveIssue();
  const restore = useMutation(api.issues.restore);

  usePresenceHeartbeat(id);

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

        <section aria-labelledby="issue-description-heading" className="mt-6 space-y-2">
          {/* Heading lives here, not inside the lazy-loaded editor — otherwise
              the section's aria-labelledby dangles during the dynamic-import
              skeleton phase and axe flags aria-prohibited-attr. */}
          <h2
            id="issue-description-heading"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Description
          </h2>
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
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
      <span className="font-mono text-xs text-zinc-500">LIN-{issue.number}</span>
      <PresenceViewers issueId={issue._id} />
      <div className="ml-auto flex items-center gap-1">
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
    </div>
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
              className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200"
              style={{
                backgroundColor: `${label.color}1f`,
                borderColor: `${label.color}66`,
              }}
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
    return <span className="px-2 text-zinc-500">{fallback}</span>;
  }
  const display = person.name ?? person.email ?? 'Member';
  return (
    <span className="flex items-center gap-2 px-2 py-1">
      <Avatar initials={getInitials(display)} image={person.image} />
      <span>{display}</span>
    </span>
  );
}
