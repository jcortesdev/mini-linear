'use client';

import { usePalette } from '@/components/palette/palette-provider';
import { SidebarDrawerTrigger } from '@/components/sidebar-drawer';
import { ThemeToggle } from '@/components/theme-toggle';
import { getInitials } from '@/lib/issue-meta';
import { useAuthActions } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '../../convex/_generated/api';

export function Topbar() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);
  const palette = usePalette();

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
  }

  const displayName = viewer?.name ?? viewer?.email ?? (viewer?.isAnonymous ? 'Guest' : 'Loading…');
  const initials = getInitials(displayName);

  return (
    <header
      aria-label="App"
      className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-2 dark:border-zinc-800 sm:gap-4 sm:px-4"
    >
      <div className="flex min-w-0 items-center gap-2">
        <SidebarDrawerTrigger />
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:h-auto sm:py-1.5"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Search or run a command…</span>
          <kbd className="ml-2 hidden rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <span
          aria-label={displayName}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 sm:hidden"
        >
          {initials}
        </span>
        <span className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:inline">
          {displayName}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
