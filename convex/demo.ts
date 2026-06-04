import type { Id } from './_generated/dataModel';
import { type MutationCtx, internalMutation } from './_generated/server';

const DEMO_SLUG = 'demo';

const SEED_LABELS = [
  { name: 'bug', color: '#ef4444' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'improvement', color: '#10b981' },
  { name: 'design', color: '#a855f7' },
  { name: 'docs', color: '#f59e0b' },
] as const;

const SEED_ISSUES = [
  {
    title: 'Set up keyboard shortcuts for navigation',
    status: 'todo' as const,
    priority: 'high' as const,
    labelIndexes: [1],
  },
  {
    title: 'Add filtering by assignee on the issue list',
    status: 'in_progress' as const,
    priority: 'medium' as const,
    labelIndexes: [1],
  },
  {
    title: 'Dark mode contrast is too low on the heatmap legend',
    status: 'in_review' as const,
    priority: 'low' as const,
    labelIndexes: [0, 3],
  },
  {
    title: 'Document the API for the issue create endpoint',
    status: 'backlog' as const,
    priority: 'no_priority' as const,
    labelIndexes: [4],
  },
  {
    title: 'Crash when deleting the last issue in a column',
    status: 'todo' as const,
    priority: 'urgent' as const,
    labelIndexes: [0],
  },
  {
    title: 'Animate the sidebar collapse',
    status: 'done' as const,
    priority: 'low' as const,
    labelIndexes: [2, 3],
  },
];

async function ensureDemoWorkspace(ctx: MutationCtx): Promise<Id<'workspaces'>> {
  const existing = await ctx.db
    .query('workspaces')
    .withIndex('by_slug', (q) => q.eq('slug', DEMO_SLUG))
    .unique();
  if (existing) return existing._id;

  const workspaceId = await ctx.db.insert('workspaces', {
    name: 'Demo',
    slug: DEMO_SLUG,
    isDemo: true,
  });

  // Bot user owns the seeded issues so anonymous joiners don't appear as creator.
  const botUserId = await ctx.db.insert('users', {
    name: 'Demo Bot',
    email: 'demo@mini-linear.local',
  });

  await ctx.db.insert('members', {
    workspaceId,
    userId: botUserId,
    role: 'owner',
  });

  const labelIds: Id<'labels'>[] = [];
  for (const label of SEED_LABELS) {
    const id = await ctx.db.insert('labels', {
      workspaceId,
      name: label.name,
      color: label.color,
    });
    labelIds.push(id);
  }

  const now = Date.now();
  for (let i = 0; i < SEED_ISSUES.length; i++) {
    const issue = SEED_ISSUES[i];
    await ctx.db.insert('issues', {
      workspaceId,
      number: i + 1,
      title: issue.title,
      description: '',
      status: issue.status,
      priority: issue.priority,
      creatorId: botUserId,
      labelIds: issue.labelIndexes.map((idx) => labelIds[idx]),
      boardOrder: (i + 1) * 1000,
      createdAt: now,
      updatedAt: now,
    });
  }

  return workspaceId;
}

/**
 * Internal admin mutation. Restores any SEED_ISSUES that have been hard-deleted
 * (or never inserted) from the demo workspace, idempotently. Soft-deleted
 * issues are NOT touched — they're recoverable via the existing Undo path or
 * `restoreAllDeleted`.
 *
 * Internal-only: invoke from the Convex dashboard, never from the client.
 * The match is by title because LIN-N numbers shift over time and the title
 * is the only stable identifier for a seed entry.
 */
export const reseedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workspace = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', DEMO_SLUG))
      .unique();
    if (!workspace) return { inserted: 0, reason: 'demo workspace missing' as const };

    const owner = await ctx.db
      .query('members')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
      .filter((q) => q.eq(q.field('role'), 'owner'))
      .first();
    if (!owner) return { inserted: 0, reason: 'demo bot owner missing' as const };

    const existingIssues = await ctx.db
      .query('issues')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
      .collect();
    const activeTitles = new Set(
      existingIssues.filter((i) => i.deletedAt === undefined).map((i) => i.title)
    );

    const existingLabels = await ctx.db
      .query('labels')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', workspace._id))
      .collect();
    const labelByName = new Map(existingLabels.map((l) => [l.name, l._id]));

    let nextNumber = existingIssues.reduce((max, i) => Math.max(max, i.number), 0) + 1;
    let nextBoardOrder = existingIssues.reduce((max, i) => Math.max(max, i.boardOrder), 0) + 1000;
    const now = Date.now();
    let inserted = 0;

    for (const seed of SEED_ISSUES) {
      if (activeTitles.has(seed.title)) continue;
      const labelIds = seed.labelIndexes
        .map((idx) => labelByName.get(SEED_LABELS[idx].name))
        .filter((id): id is Id<'labels'> => id !== undefined);

      await ctx.db.insert('issues', {
        workspaceId: workspace._id,
        number: nextNumber,
        title: seed.title,
        description: '',
        status: seed.status,
        priority: seed.priority,
        creatorId: owner.userId,
        labelIds,
        boardOrder: nextBoardOrder,
        createdAt: now,
        updatedAt: now,
      });

      nextNumber += 1;
      nextBoardOrder += 1000;
      inserted += 1;
    }

    return { inserted, reason: 'ok' as const };
  },
});

/**
 * Ensures the user is a member of the demo workspace, creating the workspace
 * (with seed labels + issues) if it doesn't exist. Idempotent.
 *
 * Called from the Convex Auth `afterUserCreatedOrUpdated` callback so new users
 * land in a populated workspace without a client-side round-trip.
 */
export async function ensureDemoMembership(
  ctx: MutationCtx,
  userId: Id<'users'>
): Promise<Id<'workspaces'>> {
  const workspaceId = await ensureDemoWorkspace(ctx);

  const existingMembership = await ctx.db
    .query('members')
    .withIndex('by_workspace_and_user', (q) =>
      q.eq('workspaceId', workspaceId).eq('userId', userId)
    )
    .unique();

  if (!existingMembership) {
    await ctx.db.insert('members', {
      workspaceId,
      userId,
      role: 'member',
    });
  }

  return workspaceId;
}
