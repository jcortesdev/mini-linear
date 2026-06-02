import { getAuthUserId } from '@convex-dev/auth/server';
import { query } from './_generated/server';

// Returns the first workspace the current user is a member of. Mini-Linear is
// single-workspace-per-user by design, so "first" is effectively "the only one".
export const viewerWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    if (!membership) return null;

    const workspace = await ctx.db.get(membership.workspaceId);
    if (!workspace) return null;

    return {
      ...workspace,
      role: membership.role,
    };
  },
});
