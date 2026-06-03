'use client';

import { usePalette } from '@/components/palette/palette-provider';
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

  return (
    <header
      aria-label="App"
      className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 dark:border-zinc-800"
    >
      <button
        type="button"
        onClick={() => palette.setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Search or run a command…</span>
        <kbd className="ml-2 rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{displayName}</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
