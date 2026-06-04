'use client';

import { type IssueStatus, STATUS_META } from '@/lib/issue-meta';
import { BoardCard } from './board-card';
import type { BoardIssue } from './board-view';

type Props = {
  status: IssueStatus;
  issues: BoardIssue[];
};

export function BoardColumn({ status, issues }: Props) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <section
      aria-label={`${meta.label} column, ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`}
      className="flex w-72 shrink-0 flex-col rounded-md bg-zinc-50 dark:bg-zinc-900/60"
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className={`h-4 w-4 ${meta.iconClass}`} />
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{meta.label}</h2>
        </div>
        <span className="text-xs text-zinc-500">{issues.length}</span>
      </header>

      <ul
        aria-label={`${meta.label} issues`}
        className="flex flex-col gap-2 overflow-y-auto px-2 pb-2"
      >
        {issues.length === 0 ? (
          <li className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
            No issues
          </li>
        ) : (
          issues.map((issue) => (
            <li key={issue._id}>
              <BoardCard issue={issue} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
