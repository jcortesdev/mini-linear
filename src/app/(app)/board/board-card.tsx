'use client';

import { PRIORITY_META, getInitials } from '@/lib/issue-meta';
import Link from 'next/link';
import type { BoardIssue } from './board-view';

type Props = {
  issue: BoardIssue;
};

// Optimistic rows are tagged with crypto.randomUUID() — a real Convex Id is pure lowercase base32
// with no dashes. Disable navigation on optimistic ids: clicking before server confirm would
// dispatch a useQuery(api.issues.get, { id: UUID }) and Convex would throw ArgumentValidationError.
function isOptimisticId(id: string): boolean {
  return id.includes('-');
}

export function BoardCard({ issue }: Props) {
  const priorityMeta = PRIORITY_META[issue.priority];
  const PriorityIcon = priorityMeta.icon;
  const assigneeName = issue.assignee?.name ?? issue.assignee?.email ?? null;
  const optimistic = isOptimisticId(issue._id);

  const content = (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:border-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <PriorityIcon
          aria-label={`Priority: ${priorityMeta.label}`}
          className={`h-3.5 w-3.5 ${priorityMeta.iconClass}`}
        />
        <span className="font-mono">LIN-{issue.number}</span>
      </div>

      <p className="text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2">{issue.title}</p>

      <div className="flex items-center justify-between gap-2">
        {issue.labels.length > 0 ? (
          <ul className="flex shrink min-w-0 flex-wrap gap-1" aria-label="Labels">
            {issue.labels.map((label) => (
              <li
                key={label._id}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-200"
                style={{
                  backgroundColor: `${label.color}1f`,
                  borderColor: `${label.color}66`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}

        {assigneeName ? (
          <span
            aria-label={`Assignee: ${assigneeName}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
          >
            {getInitials(assigneeName)}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (optimistic) {
    return (
      <div aria-label="Saving issue" className="cursor-default opacity-70">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/issues/${issue._id}`}
      data-issue-card-id={issue._id}
      className="block focus:outline-none"
    >
      {content}
    </Link>
  );
}
