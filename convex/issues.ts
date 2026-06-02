import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

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

const MAX_TITLE_LENGTH = 200;

/**
 * Creates an issue in the viewer's workspace. Assigns the next workspace-scoped
 * `number` (LIN-N) and a `boardOrder` past the current max so the new row lands
 * at the bottom of the kanban column.
 */
export const create = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('You must be signed in to create an issue.');
    }

    const title = args.title.trim();
    if (!title) {
      throw new ConvexError('Title is required.');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new ConvexError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!membership) {
      throw new ConvexError('No workspace found for this user.');
    }

    const lastByNumber = await ctx.db
      .query('issues')
      .withIndex('by_workspace_and_number', (q) => q.eq('workspaceId', membership.workspaceId))
      .order('desc')
      .first();
    const nextNumber = (lastByNumber?.number ?? 0) + 1;

    const lastByBoardOrder = await ctx.db
      .query('issues')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', membership.workspaceId))
      .collect();
    const maxBoardOrder = lastByBoardOrder.reduce((max, i) => Math.max(max, i.boardOrder), 0);

    const now = Date.now();
    const issueId = await ctx.db.insert('issues', {
      workspaceId: membership.workspaceId,
      number: nextNumber,
      title,
      status: 'backlog',
      priority: 'no_priority',
      creatorId: userId,
      labelIds: [],
      boardOrder: maxBoardOrder + 1000,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(issueId);
  },
});

function shapeUser(user: Doc<'users'> | null) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

/**
 * Loads a single issue with assignee, creator and labels resolved. Returns null
 * if the issue doesn't exist or the viewer doesn't share its workspace — both
 * collapse to "not found" on the client so we never leak existence across
 * workspaces.
 */
export const get = query({
  args: { id: v.id('issues') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const issue = await ctx.db.get(id);
    if (!issue) return null;

    const membership = await ctx.db
      .query('members')
      .withIndex('by_workspace_and_user', (q) =>
        q.eq('workspaceId', issue.workspaceId).eq('userId', userId)
      )
      .first();
    if (!membership) return null;

    const [assignee, creator] = await Promise.all([
      issue.assigneeId ? ctx.db.get(issue.assigneeId) : Promise.resolve(null),
      ctx.db.get(issue.creatorId),
    ]);
    const labels = (await Promise.all(issue.labelIds.map((labelId) => ctx.db.get(labelId)))).filter(
      (label): label is NonNullable<typeof label> => label !== null
    );

    return {
      _id: issue._id,
      number: issue.number,
      title: issue.title,
      description: issue.description ?? '',
      status: issue.status,
      priority: issue.priority,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      assignee: shapeUser(assignee),
      creator: shapeUser(creator),
      labels: labels.map((label) => ({
        _id: label._id,
        name: label.name,
        color: label.color,
      })),
    };
  },
});
