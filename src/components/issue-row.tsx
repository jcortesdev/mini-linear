'use client';

import { useUpdateIssue } from '@/lib/issue-mutations';
import type { FunctionReturnType } from 'convex/server';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { forwardRef } from 'react';
import type { api } from '../../convex/_generated/api';
import { AssigneePicker } from './assignee-picker';
import { InlineEditableTitle } from './inline-editable-title';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';

type Issue = FunctionReturnType<typeof api.issues.list>[number];

// Optimistic rows are tagged with crypto.randomUUID() — a real Convex Id is
// pure lowercase base32 with no dashes. We use this to disable navigation
// (would error with ArgumentValidationError) until the server confirms.
function isOptimisticId(id: string): boolean {
  return id.includes('-');
}

type Props = {
  issue: Issue;
  index: number;
  focused: boolean;
  onFocus: () => void;
};

export const IssueRow = forwardRef<HTMLLIElement, Props>(function IssueRow(
  { issue, index, focused, onFocus },
  ref
) {
  const update = useUpdateIssue();
  const pathname = usePathname();
  // When the slide-over is already open (URL is /issues/{id}), clicking another
  // row should REPLACE the current history entry, not push a new one. Otherwise
  // closing with the X would pop back to the previously-opened issue instead of
  // returning to /issues or /board. The slide-over swaps issues in place by
  // design (non-modal), so each swap is a navigation we don't want to remember.
  const inSlideOver = pathname?.startsWith('/issues/') ?? false;

  // Bring focus onto the row when the user mouses down on empty space inside
  // it (not on a sub-interactive: pickers, the title button, the LIN link).
  // Keyboard users already get focus via roving tabindex; this aligns mouse
  // users with the same focused-row affordance.
  function handleMouseDown(event: React.MouseEvent<HTMLLIElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, [role="listbox"], [contenteditable="true"]')) return;
    onFocus();
    // tabIndex flips to 0 on the next render via `focused`; .focus() works
    // synchronously even on tabIndex=-1 elements so we don't need to wait.
    (event.currentTarget as HTMLLIElement).focus();
  }

  return (
    <li
      ref={ref}
      data-row-index={index}
      data-issue-id={issue._id}
      tabIndex={focused ? 0 : -1}
      onFocus={onFocus}
      onMouseDown={handleMouseDown}
      className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 outline-none transition hover:bg-zinc-50 focus-visible:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900/60 dark:focus-visible:bg-zinc-900"
    >
      <PriorityPicker issueId={issue._id} priority={issue.priority} />
      <StatusPicker issueId={issue._id} status={issue.status} />

      {isOptimisticId(issue._id) ? (
        <span
          aria-label="Saving issue"
          className="flex w-16 shrink-0 items-center font-mono text-xs italic text-zinc-400 dark:text-zinc-600"
        >
          LIN-{issue.number}
        </span>
      ) : (
        <Link
          href={`/issues/${issue._id}`}
          replace={inSlideOver}
          data-issue-row-id={issue._id}
          className="flex w-16 shrink-0 items-center font-mono text-xs text-zinc-500 focus:outline-none focus-visible:underline dark:text-zinc-500"
        >
          LIN-{issue.number}
        </Link>
      )}

      <div className="flex flex-1 items-center gap-3 overflow-hidden">
        <InlineEditableTitle
          value={issue.title}
          onSave={(next) => update({ id: issue._id, title: next })}
          ariaLabel={`Edit title for LIN-${issue.number}`}
          className="flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100"
        />

        {issue.labels.length > 0 && (
          <ul className="hidden shrink-0 gap-1.5 sm:flex" aria-label="Labels">
            {issue.labels.map((label) => (
              <li
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
              </li>
            ))}
          </ul>
        )}
      </div>

      <AssigneePicker issueId={issue._id} assignee={issue.assignee} />
    </li>
  );
});
