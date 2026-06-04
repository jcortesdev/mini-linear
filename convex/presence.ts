import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';

// How long a viewer is considered "present" after their last heartbeat.
// The client heartbeats every 10s; 30s = 3× that, so a single dropped
// heartbeat doesn't flicker the avatar list.
const STALE_AFTER_MS = 30_000;

/**
 * Upserts a presence row for the current user on the given issue. Called by
 * the detail panel on mount and every 10s while open. Verifies the viewer
 * shares the issue's workspace before writing — same posture as `issues.get`
 * so we never leak existence cross-workspace.
 */
export const heartbeat = mutation({
  args: { issueId: v.id('issues') },
  handler: async (ctx, { issueId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const issue = await ctx.db.get(issueId);
    if (!issue || issue.deletedAt !== undefined) return;

    const membership = await ctx.db
      .query('members')
      .withIndex('by_workspace_and_user', (q) =>
        q.eq('workspaceId', issue.workspaceId).eq('userId', userId)
      )
      .first();
    if (!membership) return;

    const existing = await ctx.db
      .query('presence')
      .withIndex('by_issue_and_user', (q) => q.eq('issueId', issueId).eq('userId', userId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastHeartbeat: now });
    } else {
      await ctx.db.insert('presence', {
        workspaceId: issue.workspaceId,
        issueId,
        userId,
        lastHeartbeat: now,
      });
    }
  },
});

/**
 * Lists other viewers currently looking at this issue. Excludes the current
 * user (your own avatar in your own panel is noise), filters out rows older
 * than `STALE_AFTER_MS`, and returns the shape the UI needs to render
 * avatars with a tooltip.
 */
export const listByIssue = query({
  args: { issueId: v.id('issues') },
  handler: async (ctx, { issueId }) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return [];

    const issue = await ctx.db.get(issueId);
    if (!issue || issue.deletedAt !== undefined) return [];

    const membership = await ctx.db
      .query('members')
      .withIndex('by_workspace_and_user', (q) =>
        q.eq('workspaceId', issue.workspaceId).eq('userId', viewerId)
      )
      .first();
    if (!membership) return [];

    const cutoff = Date.now() - STALE_AFTER_MS;
    const rows = await ctx.db
      .query('presence')
      .withIndex('by_issue', (q) => q.eq('issueId', issueId))
      .collect();

    const fresh = rows.filter((row) => row.userId !== viewerId && row.lastHeartbeat >= cutoff);

    const viewers = await Promise.all(
      fresh.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        if (!user) return null;
        return {
          _id: user._id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          lastHeartbeat: row.lastHeartbeat,
        };
      })
    );

    return viewers.filter((viewer): viewer is NonNullable<typeof viewer> => viewer !== null);
  },
});

/**
 * Best-effort cleanup when a user signs out or wants to clear stale rows.
 * Not wired to sign-out automatically (the 30s staleness window does the
 * same job) but exposed so we can call it from devtools or the M5 cron.
 */
export const clearByUser = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('You must be signed in.');

    const rows = await ctx.db
      .query('presence')
      .withIndex('by_user_and_workspace', (q) =>
        q.eq('userId', userId).eq('workspaceId', workspaceId)
      )
      .collect();

    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { cleared: rows.length };
  },
});
