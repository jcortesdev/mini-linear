import { getAuthUserId } from '@convex-dev/auth/server';
import { query } from './_generated/server';

/**
 * Lists members of the viewer's workspace, shaped for the assignee picker:
 * id, name, email and avatar. Returns [] for unauthenticated viewers or
 * viewers without a workspace membership.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const viewerMembership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!viewerMembership) return [];

    const memberships = await ctx.db
      .query('members')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', viewerMembership.workspaceId))
      .collect();

    const users = await Promise.all(memberships.map((m) => ctx.db.get(m.userId)));

    return users
      .filter((user): user is NonNullable<typeof user> => user !== null)
      .map((user) => ({
        _id: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
      }));
  },
});
