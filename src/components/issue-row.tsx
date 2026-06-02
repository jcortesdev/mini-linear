import { PRIORITY_META, STATUS_META, getInitials } from '@/lib/issue-meta';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../convex/_generated/api';

type Issue = FunctionReturnType<typeof api.issues.list>[number];

type Props = {
  issue: Issue;
};

export function IssueRow({ issue }: Props) {
  const status = STATUS_META[issue.status];
  const priority = PRIORITY_META[issue.priority];
  const StatusIcon = status.icon;
  const PriorityIcon = priority.icon;

  return (
    <li className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60">
      <PriorityIcon
        aria-label={`Priority: ${priority.label}`}
        className={`h-4 w-4 shrink-0 ${priority.iconClass}`}
      />

      <StatusIcon
        aria-label={`Status: ${status.label}`}
        className={`h-4 w-4 shrink-0 ${status.iconClass}`}
      />

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

      <AssigneeChip assignee={issue.assignee} />
    </li>
  );
}

function AssigneeChip({ assignee }: { assignee: Issue['assignee'] }) {
  if (!assignee) {
    return (
      <span
        aria-label="Unassigned"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-300 text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
      >
        ·
      </span>
    );
  }

  const display = assignee.name ?? assignee.email ?? 'Member';
  const initials = getInitials(display);

  return (
    <span
      aria-label={`Assigned to ${display}`}
      title={display}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      {initials}
    </span>
  );
}
