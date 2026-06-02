'use client';

import { IssueRow } from '@/components/issue-row';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

export default function IssuesPage() {
  const issues = useQuery(api.issues.list);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-tight">Issues</h1>
          {issues !== undefined && (
            <span className="text-xs text-zinc-500">
              {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
            </span>
          )}
        </div>
      </header>

      {issues === undefined ? (
        <IssueListSkeleton />
      ) : issues.length === 0 ? (
        <EmptyIssues />
      ) : (
        <ul className="flex-1 overflow-auto" aria-label="Issues">
          {issues.map((issue) => (
            <IssueRow key={issue._id} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}

function IssueListSkeleton() {
  return (
    <ul aria-hidden="true" className="flex-1 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable per render
          key={i}
          className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800"
        >
          <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 flex-1 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </li>
      ))}
    </ul>
  );
}

function EmptyIssues() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="max-w-md space-y-2 text-center">
        <h2 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">No issues yet</h2>
        <p className="text-sm text-zinc-500">
          Issue creation lands in the next module. For now, the demo workspace ships with seeded
          issues — try the demo from the sign-in page to see them.
        </p>
      </div>
    </div>
  );
}
