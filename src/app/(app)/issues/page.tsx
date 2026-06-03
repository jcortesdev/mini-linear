'use client';

import { IssueCreator } from '@/components/issue-creator';
import { IssueRow } from '@/components/issue-row';
import { getNextRowIndex } from '@/lib/list-keyboard';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../../convex/_generated/api';

type Issues = FunctionReturnType<typeof api.issues.list>;

export default function IssuesPage() {
  const issues = useQuery(api.issues.list);

  return (
    <div className="flex h-full flex-col">
      <header
        aria-label="Issues page"
        className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800"
      >
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
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <IssueCreator />
          {issues.length === 0 ? <EmptyIssues /> : <IssueList issues={issues} />}
        </div>
      )}
    </div>
  );
}

function IssueList({ issues }: { issues: Issues }) {
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Keep the focused index in range when the list shrinks (e.g. after delete).
  useEffect(() => {
    if (focusedIndex >= issues.length) setFocusedIndex(issues.length - 1);
  }, [issues.length, focusedIndex]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const target = event.target as HTMLElement;
    // Don't intercept arrows / Enter / `e` while the user is typing in a
    // picker, the creator input, or any editable surface.
    if (isEditableTarget(target)) return;

    // Resolve the index for the keystroke from the *actual* focused li when
    // possible — React state can lag the focus event from a fresh .focus()
    // call, and we'd rather move from where the user is than where we last
    // recorded.
    const liveIndex = readRowIndex(target) ?? focusedIndex;

    if (event.key === 'Enter' && liveIndex >= 0) {
      // Click the row's <Link> instead of router.push so Next.js fires its
      // intercepting route and the slide-over panel opens. router.push bypasses
      // interception.
      const row = rowRefs.current[liveIndex];
      const link = row?.querySelector<HTMLAnchorElement>('a[data-issue-row-id]');
      if (link) {
        event.preventDefault();
        // Dispatch a synthetic MouseEvent — `.click()` doesn't always reach
        // Next.js's Link click handler (it short-circuits its own dispatch).
        link.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 })
        );
        return;
      }
    }

    if (event.key === 'e' && liveIndex >= 0) {
      const row = rowRefs.current[liveIndex];
      const editBtn = row?.querySelector<HTMLButtonElement>('[data-edit-title]');
      if (editBtn) {
        event.preventDefault();
        editBtn.click();
        return;
      }
    }

    const next = getNextRowIndex(liveIndex, event.key, issues.length);
    if (next !== null) {
      event.preventDefault();
      setFocusedIndex(next);
      rowRefs.current[next]?.focus();
    }
  }

  return (
    <ul aria-label="Issues" className="flex-1 overflow-auto outline-none" onKeyDown={handleKeyDown}>
      {issues.map((issue, index) => (
        <IssueRow
          key={issue._id}
          ref={(el) => {
            rowRefs.current[index] = el;
          }}
          issue={issue}
          index={index}
          focused={index === focusedIndex || (focusedIndex === -1 && index === 0)}
          onFocus={() => setFocusedIndex(index)}
        />
      ))}
    </ul>
  );
}

function readRowIndex(target: HTMLElement | null): number | null {
  const row = target?.closest<HTMLElement>('li[data-row-index]');
  if (!row) return null;
  const value = Number(row.dataset.rowIndex);
  return Number.isNaN(value) ? null : value;
}

function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  // Pickers handle Enter/Space themselves; let them have it.
  if (target.getAttribute('role') === 'listbox') return true;
  return false;
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
          Press{' '}
          <kbd className="rounded border border-zinc-300 px-1 font-mono text-xs dark:border-zinc-700">
            c
          </kbd>{' '}
          or use the button above to create your first issue.
        </p>
      </div>
    </div>
  );
}
