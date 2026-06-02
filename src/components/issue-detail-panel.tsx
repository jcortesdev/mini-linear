'use client';

import { PRIORITY_META, STATUS_META, getInitials } from '@/lib/issue-meta';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Issue = NonNullable<FunctionReturnType<typeof api.issues.get>>;

type Props = {
  id: Id<'issues'>;
  onClose: () => void;
  /** Pass `true` when the panel is rendered inline as a full route (no close button). */
  fullPage?: boolean;
};

export function IssueDetailPanel({ id, onClose, fullPage = false }: Props) {
  const issue = useQuery(api.issues.get, { id });

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
      <Header issue={issue} onClose={onClose} fullPage={fullPage} />
      <div className="flex-1 overflow-auto px-6 py-5">
        <h1 id="issue-detail-title" className="text-xl font-semibold leading-snug">
          {issue.title}
        </h1>

        <Metadata issue={issue} />

        <section aria-labelledby="issue-description-heading" className="mt-6">
          <h2
            id="issue-description-heading"
            className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Description
          </h2>
          {issue.description.trim() ? (
            <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.description}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm italic text-zinc-400">No description.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Header({
  issue,
  onClose,
  fullPage,
}: {
  issue: Issue;
  onClose: () => void;
  fullPage: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Move focus into the panel as soon as the close button mounts — by the time
  // the panel renders we're past the loading state, so the slide-over's own
  // mount effect would have run too early.
  useEffect(() => {
    if (!fullPage) closeRef.current?.focus();
  }, [fullPage]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
      <span className="font-mono text-xs text-zinc-500">LIN-{issue.number}</span>
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
    </header>
  );
}

function Metadata({ issue }: { issue: Issue }) {
  const status = STATUS_META[issue.status];
  const priority = PRIORITY_META[issue.priority];
  const StatusIcon = status.icon;
  const PriorityIcon = priority.icon;

  return (
    <dl className="mt-5 grid grid-cols-[80px_1fr] gap-x-4 gap-y-3 text-sm">
      <Term>Status</Term>
      <Detail>
        <StatusIcon aria-hidden="true" className={`h-4 w-4 ${status.iconClass}`} />
        <span>{status.label}</span>
      </Detail>

      <Term>Priority</Term>
      <Detail>
        <PriorityIcon aria-hidden="true" className={`h-4 w-4 ${priority.iconClass}`} />
        <span>{priority.label}</span>
      </Detail>

      <Term>Assignee</Term>
      <Detail>
        <PersonChip person={issue.assignee} fallback="Unassigned" />
      </Detail>

      <Term>Creator</Term>
      <Detail>
        <PersonChip person={issue.creator} fallback="Unknown" />
      </Detail>

      <Term>Labels</Term>
      <Detail>
        {issue.labels.length === 0 ? (
          <span className="text-zinc-400">No labels</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Labels">
            {issue.labels.map((label) => (
              <li
                key={label._id}
                className="flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </li>
            ))}
          </ul>
        )}
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
    return <span className="text-zinc-400">{fallback}</span>;
  }
  const display = person.name ?? person.email ?? 'Member';
  return (
    <>
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {getInitials(display)}
      </span>
      <span>{display}</span>
    </>
  );
}
