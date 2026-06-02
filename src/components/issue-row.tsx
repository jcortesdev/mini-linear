import type { FunctionReturnType } from 'convex/server';
import Link from 'next/link';
import type { api } from '../../convex/_generated/api';
import { AssigneePicker } from './assignee-picker';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';

type Issue = FunctionReturnType<typeof api.issues.list>[number];

type Props = {
  issue: Issue;
};

export function IssueRow({ issue }: Props) {
  return (
    <li className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60">
      <PriorityPicker issueId={issue._id} priority={issue.priority} />
      <StatusPicker issueId={issue._id} status={issue.status} />

      <Link
        href={`/issues/${issue._id}`}
        data-issue-row-id={issue._id}
        className="flex flex-1 items-center gap-3 focus:outline-none focus-visible:underline"
      >
        <span className="w-16 shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-500">
          LIN-{issue.number}
        </span>

        <span className="flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">
          {issue.title}
        </span>

        {issue.labels.length > 0 && (
          <ul className="hidden shrink-0 gap-1.5 sm:flex" aria-label="Labels">
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
      </Link>

      <AssigneePicker issueId={issue._id} assignee={issue.assignee} />
    </li>
  );
}
