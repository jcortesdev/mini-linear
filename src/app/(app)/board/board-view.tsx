'use client';

import type { IssueStatus } from '@/lib/issue-meta';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../../convex/_generated/api';
import { ISSUE_STATUS } from '../../../../convex/schema';
import { BoardColumn } from './board-column';

export type BoardIssue = FunctionReturnType<typeof api.issues.list>[number];

export function BoardView() {
  const issues = useQuery(api.issues.list);

  if (issues === undefined) return <BoardSkeleton />;

  const grouped = groupByStatus(issues);

  return (
    <div className="flex h-full flex-col">
      <header
        aria-label="Board page"
        className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800"
      >
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-tight">Board</h1>
          <span className="text-xs text-zinc-500">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3">
        {ISSUE_STATUS.map((status) => (
          <BoardColumn key={status} status={status} issues={grouped[status]} />
        ))}
      </div>
    </div>
  );
}

function groupByStatus(issues: BoardIssue[]): Record<IssueStatus, BoardIssue[]> {
  const buckets: Record<IssueStatus, BoardIssue[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    canceled: [],
  };
  for (const issue of issues) {
    buckets[issue.status].push(issue);
  }
  return buckets;
}

function BoardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div
        aria-hidden="true"
        className="flex h-12 shrink-0 items-center border-b border-zinc-200 px-4 dark:border-zinc-800"
      >
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {ISSUE_STATUS.map((status) => (
          <div
            key={status}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-md bg-zinc-50 p-2 dark:bg-zinc-900/60"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-16 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-16 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
