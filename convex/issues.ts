import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { ISSUE_PRIORITY, ISSUE_STATUS } from './schema';

const statusValidator = v.union(...ISSUE_STATUS.map((s) => v.literal(s)));
const priorityValidator = v.union(...ISSUE_PRIORITY.map((p) => v.literal(p)));

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

    const active = issues.filter((issue) => issue.deletedAt === undefined);

    return await Promise.all(
      active.map(async (issue) => {
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
    if (!issue || issue.deletedAt !== undefined) return null;

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

/**
 * Updates one or more fields on an issue. Every field is optional — only the
 * ones the caller passes are written. `assigneeId: null` clears the assignee;
 * `undefined` (omitted) leaves it untouched.
 */
export const update = mutation({
  args: {
    id: v.id('issues'),
    title: v.optional(v.string()),
    status: v.optional(statusValidator),
    priority: v.optional(priorityValidator),
    assigneeId: v.optional(v.union(v.id('users'), v.null())),
    description: v.optional(v.string()),
    labelIds: v.optional(v.array(v.id('labels'))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('You must be signed in.');

    const issue = await ctx.db.get(args.id);
    if (!issue) throw new ConvexError('Issue not found.');

    const membership = await ctx.db
      .query('members')
      .withIndex('by_workspace_and_user', (q) =>
        q.eq('workspaceId', issue.workspaceId).eq('userId', userId)
      )
      .first();
    if (!membership) throw new ConvexError('Issue not found.');

    const patch: Partial<Doc<'issues'>> = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const trimmed = args.title.trim();
      if (!trimmed) throw new ConvexError('Title is required.');
      if (trimmed.length > MAX_TITLE_LENGTH) {
        throw new ConvexError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
      }
      patch.title = trimmed;
    }
    if (args.status !== undefined) patch.status = args.status;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.description !== undefined) patch.description = args.description;
    if (args.labelIds !== undefined) patch.labelIds = args.labelIds;
    if (args.assigneeId !== undefined) {
      patch.assigneeId = args.assigneeId ?? undefined;
    }

    await ctx.db.patch(args.id, patch);
    return await ctx.db.get(args.id);
  },
});

/**
 * Soft-delete: sets `deletedAt`. List and detail queries filter these out, so
 * the row vanishes immediately while the doc sticks around for Undo.
 */
export const remove = mutation({
  args: { id: v.id('issues') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('You must be signed in.');

    const issue = await ctx.db.get(id);
    if (!issue) throw new ConvexError('Issue not found.');

    const membership = await ctx.db
      .query('members')
      .withIndex('by_workspace_and_user', (q) =>
        q.eq('workspaceId', issue.workspaceId).eq('userId', userId)
      )
      .first();
    if (!membership) throw new ConvexError('Issue not found.');

    await ctx.db.patch(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  },
});

/**
 * Clears the soft-delete timestamp, bringing the issue back to the list with
 * its original id, number, position, assignee and labels intact. Uses
 * `replace` to fully drop the `deletedAt` key — `patch({deletedAt: undefined})`
 * is a no-op in Convex 1.39 because undefined is dropped during serialization.
 */
export const restore = mutation({
  args: { id: v.id('issues') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('You must be signed in.');

    const issue = await ctx.db.get(id);
    if (!issue) throw new ConvexError('Issue not found.');

    const membership = await ctx.db
      .query('members')
      .withIndex('by_workspace_and_user', (q) =>
        q.eq('workspaceId', issue.workspaceId).eq('userId', userId)
      )
      .first();
    if (!membership) throw new ConvexError('Issue not found.');

    const { _id, _creationTime, deletedAt: _deletedAt, ...rest } = issue;
    await ctx.db.replace(id, { ...rest, updatedAt: Date.now() });
  },
});

/**
 * Hard-deletes every issue in the viewer's workspace whose title starts with
 * the given prefix. Intended for Playwright cleanup (`[e2e]`) — soft-delete
 * would leave the test rows in the DB forever. The prefix must be at least 3
 * characters long to make accidental wipes harder; an empty/short prefix would
 * be catastrophic on the shared demo workspace.
 */
export const purgeByTitlePrefix = mutation({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    if (prefix.trim().length < 3) {
      throw new ConvexError('Prefix must be at least 3 characters.');
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('You must be signed in.');

    const membership = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!membership) return { deleted: 0 };

    const issues = await ctx.db
      .query('issues')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', membership.workspaceId))
      .collect();

    const targets = issues.filter((i) => i.title.startsWith(prefix));
    await Promise.all(targets.map((i) => ctx.db.delete(i._id)));
    return { deleted: targets.length };
  },
});
