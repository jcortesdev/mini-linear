'use client';

import { useQuery } from 'convex/react';
import { KanbanSquare, ListTodo } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { NavLink } from './nav-link';

type Variant = 'static' | 'drawer';

/**
 * Workspace nav. Rendered two ways:
 *  - `static` (default): inline sidebar visible at `lg` and up; hidden below.
 *  - `drawer`: mounted inside the Radix Dialog for the mobile drawer; no
 *    border/visibility classes because the Dialog provides them.
 */
export function Sidebar({ variant = 'static' }: { variant?: Variant } = {}) {
  const workspace = useQuery(api.workspaces.viewerWorkspace);
  const isDrawer = variant === 'drawer';

  return (
    <aside
      aria-label={isDrawer ? undefined : 'Workspace navigation'}
      className={
        isDrawer
          ? 'flex h-full flex-col'
          : 'hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 lg:flex'
      }
    >
      <div className="flex h-12 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        {workspace ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <WorkspaceMark name={workspace.name} />
            <span className="truncate">{workspace.name}</span>
            {workspace.isDemo && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                Demo
              </span>
            )}
          </div>
        ) : (
          <div
            className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
            aria-hidden="true"
          />
        )}
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-0.5 p-2">
        <NavLink href="/issues" icon={<ListTodo className="h-4 w-4" />}>
          Issues
        </NavLink>
        <NavLink href="/board" icon={<KanbanSquare className="h-4 w-4" />}>
          Board
        </NavLink>
      </nav>
    </aside>
  );
}

function WorkspaceMark({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      {initial}
    </span>
  );
}
