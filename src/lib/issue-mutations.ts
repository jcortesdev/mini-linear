/**
 * Shared optimistic-update hooks for the `issues` table. Every UI surface
 * that mutates an issue (pickers, inline title edit, description editor,
 * detail panel, command palette) calls into here so the optimistic writes
 * stay in lock-step with the server shape.
 */

import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useUpdateIssue() {
  return useMutation(api.issues.update).withOptimisticUpdate((localStore, args) => {
    // Resolve relational fields against cached queries so the local row keeps
    // the same shape the server query returns.
    const cachedMembers =
      args.assigneeId !== undefined ? localStore.getQuery(api.members.list, {}) : undefined;
    const cachedLabels =
      args.labelIds !== undefined ? localStore.getQuery(api.labels.list, {}) : undefined;

    function patchRow<T extends Record<string, unknown>>(row: T): T {
      const next: Record<string, unknown> = { ...row };
      if (args.title !== undefined) next.title = args.title;
      if (args.status !== undefined) next.status = args.status;
      if (args.priority !== undefined) next.priority = args.priority;
      if (args.description !== undefined) next.description = args.description;
      if (args.assigneeId !== undefined) {
        if (args.assigneeId === null) {
          next.assignee = null;
        } else if (cachedMembers !== undefined) {
          next.assignee = cachedMembers.find((m) => m._id === args.assigneeId) ?? null;
        }
      }
      if (args.labelIds !== undefined && cachedLabels !== undefined) {
        next.labels = args.labelIds
          .map((id) => cachedLabels.find((l) => l._id === id))
          .filter((l): l is NonNullable<typeof l> => l !== undefined)
          .map((l) => ({ _id: l._id, name: l.name, color: l.color }));
      }
      return next as T;
    }

    const list = localStore.getQuery(api.issues.list, {});
    if (list) {
      localStore.setQuery(
        api.issues.list,
        {},
        list.map((i) => (i._id === args.id ? patchRow(i) : i))
      );
    }

    const detail = localStore.getQuery(api.issues.get, { id: args.id });
    if (detail) {
      localStore.setQuery(api.issues.get, { id: args.id }, patchRow(detail));
    }
  });
}

export function useRemoveIssue() {
  return useMutation(api.issues.remove).withOptimisticUpdate((localStore, args) => {
    const list = localStore.getQuery(api.issues.list, {});
    if (list) {
      localStore.setQuery(
        api.issues.list,
        {},
        list.filter((i) => i._id !== args.id)
      );
    }
  });
}
