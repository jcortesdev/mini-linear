'use client';

import { computeInsertOrder } from '@/lib/board-order';
import type { IssueStatus } from '@/lib/issue-meta';
import { useUpdateIssue } from '@/lib/issue-mutations';
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../../convex/_generated/api';
import { ISSUE_STATUS } from '../../../../convex/schema';
import { BoardCardContent } from './board-card';
import { BoardColumn } from './board-column';

export type BoardIssue = FunctionReturnType<typeof api.issues.list>[number];
type Grouped = Record<IssueStatus, BoardIssue[]>;

/**
 * Multi-container collision strategy for the kanban: use `pointerWithin` so
 * the empty space of an empty column accepts drops as soon as the cursor is
 * inside it (the canonical `closestCorners` would prefer a card in a busy
 * neighbour column over an empty one and felt broken for most drops). Fall
 * back to `rectIntersection` for keyboard-driven moves, where there is no
 * pointer position to read.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    // When the pointer is inside both a card and its parent column droppable,
    // prefer the card so dropping onto a slot inserts there rather than
    // appending to the column.
    return [...pointerCollisions].sort((a, b) => {
      const aType = args.droppableContainers.find((c) => c.id === a.id)?.data.current?.type;
      const bType = args.droppableContainers.find((c) => c.id === b.id)?.data.current?.type;
      if (aType === 'card' && bType !== 'card') return -1;
      if (bType === 'card' && aType !== 'card') return 1;
      return 0;
    });
  }
  return rectIntersection(args);
};

export function BoardView() {
  const issues = useQuery(api.issues.list);
  const updateIssue = useUpdateIssue();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // `grouped` is derived from the query — the `useUpdateIssue` optimistic
  // patch writes `status` + `boardOrder` straight onto the cached list, so
  // the next render of this memo reflects the drop instantly.
  const grouped = useMemo<Grouped>(() => groupByStatus(issues ?? []), [issues]);

  const sensors = useSensors(
    // Distance 8 keeps mouse clicks from triggering a drag — the Link inside
    // each card still navigates to the slide-over on a plain click.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeIssue = useMemo(() => {
    if (!activeId) return null;
    for (const status of ISSUE_STATUS) {
      const found = grouped[status].find((i) => i._id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, grouped]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeIssueId = active.id as string;
    const overData = over.data.current as
      | { type: 'card'; status: IssueStatus }
      | { type: 'column'; status: IssueStatus }
      | undefined;

    const sourceStatus = findStatusOf(grouped, activeIssueId);
    if (!sourceStatus) return;

    const destStatus = overData?.status ?? findStatusOf(grouped, over.id as string);
    if (!destStatus) return;

    const droppedOnColumn = overData?.type === 'column';
    if (!droppedOnColumn && active.id === over.id) return;

    const sourceItems = grouped[sourceStatus];
    const destItems = grouped[destStatus];
    const fromIdx = sourceItems.findIndex((i) => i._id === activeIssueId);
    if (fromIdx === -1) return;
    const activeItem = sourceItems[fromIdx];

    // Walk the destination column WITHOUT the active item, find the slot it
    // lands in, then read the neighbours' boardOrder to compute the new one.
    const destWithoutActive =
      sourceStatus === destStatus
        ? [...destItems.slice(0, fromIdx), ...destItems.slice(fromIdx + 1)]
        : destItems;

    let insertIdx: number;
    if (droppedOnColumn) {
      insertIdx = destWithoutActive.length;
    } else {
      const overIdx = destWithoutActive.findIndex((i) => i._id === over.id);
      if (overIdx === -1) return;
      insertIdx = overIdx;
    }

    const prev = destWithoutActive[insertIdx - 1]?.boardOrder;
    const next = destWithoutActive[insertIdx]?.boardOrder;
    const boardOrder = computeInsertOrder({ prev, next });

    // Skip if the move is a no-op (same column, same slot, same boardOrder).
    if (
      sourceStatus === destStatus &&
      activeItem.boardOrder === boardOrder &&
      destItems[insertIdx]?._id === activeIssueId
    ) {
      return;
    }

    updateIssue({ id: activeItem._id, status: destStatus, boardOrder }).catch(() => {
      // The optimistic write rolls back automatically; we swallow the error
      // here so a transient network blip doesn't surface a raw exception.
    });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  if (issues === undefined) return <BoardSkeleton />;

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

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3">
          {ISSUE_STATUS.map((status) => (
            <BoardColumn key={status} status={status} issues={grouped[status]} />
          ))}
        </div>

        {mounted &&
          createPortal(
            <DragOverlay>
              {activeIssue ? <BoardCardContent issue={activeIssue} /> : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </div>
  );
}

function groupByStatus(issues: BoardIssue[]): Grouped {
  const buckets: Grouped = {
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
  // Each column renders in ascending `boardOrder`. Ties are broken by the
  // server-assigned `number` so the order is fully deterministic.
  for (const status of ISSUE_STATUS) {
    buckets[status].sort((a, b) => a.boardOrder - b.boardOrder || a.number - b.number);
  }
  return buckets;
}

function findStatusOf(grouped: Grouped, id: string): IssueStatus | null {
  for (const status of ISSUE_STATUS) {
    if (grouped[status].some((i) => i._id === id)) return status;
  }
  return null;
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
