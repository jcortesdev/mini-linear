import { getAuthUserId } from '@convex-dev/auth/server';
import { query } from './_generated/server';

/**
 * Lists issues in the current user's workspace, with assignee and labels
 * resolved server-side so the client gets a fully-shaped object per row.
 *
 * Returns [] if the user is unauthenticated or hasn't been added to any
 * workspace yet — the page renders an empty state in either case.
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

    const issues = await ctx.db
      .query('issues')
      .withIndex('by_workspace_and_number', (q) => q.eq('workspaceId', membership.workspaceId))
      .collect();

    return await Promise.all(
      issues.map(async (issue) => {
        const assignee = issue.assigneeId ? await ctx.db.get(issue.assigneeId) : null;
        const labels = (await Promise.all(issue.labelIds.map((id) => ctx.db.get(id)))).filter(
          (label): label is NonNullable<typeof label> => label !== null
        );

        return {
          _id: issue._id,
          number: issue.number,
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          createdAt: issue.createdAt,
          assignee: assignee
            ? {
                _id: assignee._id,
                name: assignee.name ?? null,
                email: assignee.email ?? null,
                image: assignee.image ?? null,
              }
            : null,
          labels: labels.map((label) => ({
            _id: label._id,
            name: label.name,
            color: label.color,
          })),
        };
      })
    );
  },
});
