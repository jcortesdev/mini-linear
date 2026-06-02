import { getAuthUserId } from '@convex-dev/auth/server';
import { query } from './_generated/server';

/**
 * Lists labels in the viewer's workspace, shape `{ _id, name, color }`. Returns
 * [] when the viewer is unauthenticated or has no workspace membership.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!membership) return [];

    const labels = await ctx.db
      .query('labels')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', membership.workspaceId))
      .collect();

    return labels.map((label) => ({
      _id: label._id,
      name: label.name,
      color: label.color,
    }));
  },
});
