import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const ISSUE_STATUS = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled',
] as const;

export const ISSUE_PRIORITY = ['no_priority', 'urgent', 'high', 'medium', 'low'] as const;

export const MEMBER_ROLE = ['owner', 'member'] as const;

const statusValidator = v.union(...ISSUE_STATUS.map((s) => v.literal(s)));
const priorityValidator = v.union(...ISSUE_PRIORITY.map((p) => v.literal(p)));
const roleValidator = v.union(...MEMBER_ROLE.map((r) => v.literal(r)));

export default defineSchema({
  // Convex Auth manages users, authSessions, authAccounts, etc.
  ...authTables,

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    isDemo: v.optional(v.boolean()),
  }).index('by_slug', ['slug']),

  members: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    role: roleValidator,
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_user', ['userId'])
    .index('by_workspace_and_user', ['workspaceId', 'userId']),

  labels: defineTable({
    workspaceId: v.id('workspaces'),
    name: v.string(),
    color: v.string(),
  }).index('by_workspace', ['workspaceId']),

  issues: defineTable({
    workspaceId: v.id('workspaces'),
    // Per-workspace sequential number (LIN-1, LIN-2, ...). Assigned by the create mutation.
    number: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    status: statusValidator,
    priority: priorityValidator,
    assigneeId: v.optional(v.id('users')),
    creatorId: v.id('users'),
    labelIds: v.array(v.id('labels')),
    // Float index used by the kanban board for cheap reordering.
    boardOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Soft-delete timestamp. Absent = active. Set by the `remove` mutation,
    // cleared by `restore`. Queries filter these out so the deletion looks
    // immediate but Undo can still revive the row by id.
    deletedAt: v.optional(v.number()),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_and_status', ['workspaceId', 'status'])
    .index('by_workspace_and_number', ['workspaceId', 'number'])
    .index('by_assignee', ['assigneeId']),
});
