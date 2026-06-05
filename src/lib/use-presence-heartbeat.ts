'use client';

import { useMutation } from 'convex/react';
import { useEffect } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Fires the presence heartbeat immediately on mount and every 10s after, until
 * the component unmounts or `issueId` changes. The mutation silently no-ops
 * when the viewer is unauthenticated or doesn't share the issue's workspace,
 * so we don't guard here.
 *
 * Errors from individual heartbeats are swallowed — a single dropped network
 * call is recoverable by the next tick; we'd rather not pollute the UI with
 * transient toasts.
 */
export function usePresenceHeartbeat(issueId: Id<'issues'>) {
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      heartbeat({ issueId }).catch(() => {});
    }

    tick();
    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [issueId, heartbeat]);
}
