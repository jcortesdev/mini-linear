'use client';

import { PRIORITY_META, getInitials } from '@/lib/issue-meta';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';
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

/**
 * Pure presentational card — used both as the sortable card body and as the
 * snapshot rendered inside the global <DragOverlay /> during an active drag.
 */
export function BoardCardContent({ issue }: Props) {
  const priorityMeta = PRIORITY_META[issue.priority];
  const PriorityIcon = priorityMeta.icon;
  const assigneeName = issue.assignee?.name ?? issue.assignee?.email ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:border-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <PriorityIcon
          aria-label={`Priority: ${priorityMeta.label}`}
          className={`h-3.5 w-3.5 ${priorityMeta.iconClass}`}
        />
        <span className="font-mono">LIN-{issue.number}</span>
      </div>

      <p className="line-clamp-2 text-sm text-zinc-900 dark:text-zinc-100">{issue.title}</p>

      <div className="flex items-center justify-between gap-2">
        {issue.labels.length > 0 ? (
          <ul aria-label="Labels" className="flex min-w-0 shrink flex-wrap gap-1">
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
}

export function BoardCard({ issue }: Props) {
  const optimistic = isOptimisticId(issue._id);
  const reducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue._id,
    // Optimistic cards have no server-side id yet — disable drag activation so
    // they can't fire a boardOrder update against a UUID that Convex would reject.
    disabled: optimistic,
    data: { type: 'card', status: issue.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    // Drop the slide-into-place transition when the user prefers reduced
    // motion — cards still rearrange, they just snap instead of animate.
    transition: reducedMotion ? undefined : transition,
  };

  if (optimistic) {
    return (
      <div ref={setNodeRef} aria-label="Saving issue" className="cursor-default opacity-70">
        <BoardCardContent issue={issue} />
      </div>
    );
  }

  return (
    <Link
      ref={setNodeRef}
      href={`/issues/${issue._id}`}
      data-issue-card-id={issue._id}
      style={style}
      className="block touch-none focus:outline-none"
      {...attributes}
      {...listeners}
    >
      {isDragging ? <DragSourcePlaceholder issue={issue} /> : <BoardCardContent issue={issue} />}
    </Link>
  );
}

/**
 * Source-slot placeholder shown while the user is dragging a card. Renders a
 * dashed-border outline at the card's natural size so the layout doesn't jump,
 * with the card content hidden via `visibility: hidden` (preserving block
 * dimensions without flashing text underneath).
 *
 * Replaces the previous `opacity: 0.3` ghost, which tripped axe's color-contrast
 * rule (composited opacity → ~1.5:1 against white). The dashed border has no
 * text content so no contrast rule applies.
 */
function DragSourcePlaceholder({ issue }: Props) {
  return (
    <div
      aria-hidden="true"
      className="rounded-md border-2 border-dashed border-zinc-300 bg-transparent dark:border-zinc-700"
    >
      <div className="invisible">
        <BoardCardContent issue={issue} />
      </div>
    </div>
  );
}
