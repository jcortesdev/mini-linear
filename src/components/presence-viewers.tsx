'use client';

import { getInitials } from '@/lib/issue-meta';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Avatar } from './avatar';

const MAX_VISIBLE = 3;

type Props = {
  issueId: Id<'issues'>;
};

/**
 * Shows up to 3 stacked avatars of other users currently viewing the same
 * issue, plus a `+N` overflow chip when more are present. Renders nothing
 * when no one else is here — keeps the panel header quiet by default.
 *
 * The list excludes the current viewer server-side (see `convex/presence.ts`).
 */
export function PresenceViewers({ issueId }: Props) {
  const viewers = useQuery(api.presence.listByIssue, { issueId });

  if (!viewers || viewers.length === 0) return null;

  const visible = viewers.slice(0, MAX_VISIBLE);
  const overflow = viewers.length - visible.length;
  const summary =
    viewers.length === 1 ? '1 other person viewing' : `${viewers.length} other people viewing`;

  return (
    // `role="group"` (not `<fieldset>`) is intentional: this is a labelled
    // collection of presence indicators, not a form control grouping.
    // biome-ignore lint/a11y/useSemanticElements: see comment above.
    <div aria-label={summary} role="group" className="flex items-center pl-1">
      {visible.map((viewer) => {
        const display = viewer.name ?? viewer.email ?? 'Member';
        return (
          <span
            key={viewer._id}
            title={display}
            className="-ml-1 inline-flex rounded-full ring-2 ring-white first:ml-0 dark:ring-zinc-950"
          >
            <Avatar initials={getInitials(display)} image={viewer.image} size="sm" />
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          aria-hidden="true"
          className="-ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-200 px-1 text-[9px] font-semibold text-zinc-700 ring-2 ring-white dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-950"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
