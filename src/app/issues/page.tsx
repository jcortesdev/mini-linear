'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '../../../convex/_generated/api';

export default function IssuesPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.viewer);

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Signed in to Mini-Linear</h1>
        <p className="text-sm text-zinc-500">
          {currentUser?.name
            ? `Welcome back, ${currentUser.name}.`
            : currentUser?.email
              ? `Welcome back, ${currentUser.email}.`
              : currentUser?.isAnonymous
                ? 'You’re browsing the demo workspace.'
                : 'You’re signed in.'}
        </p>
        <p className="text-xs text-zinc-400">
          The full issue list lands in the next module — this page is a placeholder.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
