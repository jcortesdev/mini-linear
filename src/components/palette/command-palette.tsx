'use client';

import {
  type IssuePriority,
  type IssueStatus,
  PRIORITY_META,
  STATUS_META,
  getInitials,
} from '@/lib/issue-meta';
import { useRemoveIssue, useUpdateIssue } from '@/lib/issue-mutations';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useMutation, useQuery } from 'convex/react';
import { KanbanSquare, ListTodo, Plus, Trash2, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useToast } from '../toast-provider';
import { usePalette } from './palette-provider';

const GROUP_HEADING_CLASS =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500';

// Convex ids are lowercase base32, no dashes. We use that to discriminate from
// optimistic crypto.randomUUID() ids that briefly appear in row links.
function parseIssueId(path: string | null): Id<'issues'> | null {
  if (!path) return null;
  const match = path.match(/^\/issues\/([^/]+)(?:\/.*)?$/);
  if (!match) return null;
  const candidate = match[1];
  if (candidate.includes('-')) return null;
  return candidate as Id<'issues'>;
}

export function CommandPalette() {
  const { open, setOpen, requestNewIssue } = usePalette();
  const router = useRouter();
  const pathname = usePathname();
  const issueId = parseIssueId(pathname);
  const issue = useQuery(api.issues.get, issueId ? { id: issueId } : 'skip');
  const update = useUpdateIssue();
  const remove = useRemoveIssue();
  const restore = useMutation(api.issues.restore);
  const members = useQuery(api.members.list);
  const labels = useQuery(api.labels.list);
  const { toast } = useToast();

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  function newIssue() {
    setOpen(false);
    if (pathname !== '/issues') router.push('/issues');
    requestNewIssue();
  }

  function changeStatus(status: IssueStatus) {
    if (!issue) return;
    setOpen(false);
    if (issue.status !== status) {
      update({ id: issue._id, status }).catch(() => {});
    }
  }

  function changePriority(priority: IssuePriority) {
    if (!issue) return;
    setOpen(false);
    if (issue.priority !== priority) {
      update({ id: issue._id, priority }).catch(() => {});
    }
  }

  function assignTo(memberId: Id<'users'> | null) {
    if (!issue) return;
    setOpen(false);
    if ((issue.assignee?._id ?? null) !== memberId) {
      update({ id: issue._id, assigneeId: memberId }).catch(() => {});
    }
  }

  function toggleLabel(labelId: Id<'labels'>) {
    if (!issue) return;
    setOpen(false);
    const next = new Set(issue.labels.map((l) => l._id));
    if (next.has(labelId)) next.delete(labelId);
    else next.add(labelId);
    update({ id: issue._id, labelIds: Array.from(next) }).catch(() => {});
  }

  function deleteIssue() {
    if (!issue) return;
    const snapshot = { id: issue._id, number: issue.number };
    setOpen(false);
    // Bounce back to the list — staying on /issues/<id> after the soft-delete
    // would render the "Issue not found" fallback.
    if (pathname?.startsWith('/issues/')) router.push('/issues');
    remove({ id: snapshot.id })
      .then(() => {
        toast({
          title: `LIN-${snapshot.number} deleted.`,
          duration: 6000,
          action: {
            label: 'Undo',
            onClick: () => {
              restore({ id: snapshot.id }).catch(() => {
                toast({ title: 'Could not restore issue.', variant: 'error' });
              });
            },
          },
        });
      })
      .catch(() => {
        toast({ title: 'Could not delete issue.', variant: 'error' });
      });
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:opacity-100 data-[state=closed]:opacity-0 motion-reduce:transition-none transition-opacity duration-150"
      contentClassName="fixed left-1/2 top-[18%] z-[100] w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl outline-none data-[state=open]:opacity-100 data-[state=closed]:opacity-0 motion-reduce:transition-none transition-opacity duration-150 dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* Radix Dialog requires a Title + Description for screen readers; cmdk
          does not inject them automatically. */}
      <Dialog.Title className="sr-only">Command palette</Dialog.Title>
      <Dialog.Description className="sr-only">
        Search and run commands. Use arrow keys to navigate, enter to confirm, escape to close.
      </Dialog.Description>

      <Command.Input
        placeholder="Search or run a command…"
        className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm text-zinc-900 placeholder-zinc-500 outline-none dark:border-zinc-800 dark:text-zinc-100"
      />
      <Command.List className="max-h-[400px] overflow-y-auto p-1">
        <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-500">
          No results.
        </Command.Empty>

        <Command.Group heading="Create" className={GROUP_HEADING_CLASS}>
          <PaletteItem
            value="new issue"
            icon={<Plus aria-hidden="true" className="h-4 w-4" />}
            label="New issue"
            shortcut={['c']}
            onSelect={newIssue}
          />
        </Command.Group>

        <Command.Group heading="Navigation" className={GROUP_HEADING_CLASS}>
          <PaletteItem
            value="go to issues"
            icon={<ListTodo aria-hidden="true" className="h-4 w-4" />}
            label="Go to Issues"
            shortcut={['g', 'i']}
            onSelect={() => go('/issues')}
          />
          <PaletteItem
            value="go to board"
            icon={<KanbanSquare aria-hidden="true" className="h-4 w-4" />}
            label="Go to Board"
            shortcut={['g', 'b']}
            onSelect={() => go('/board')}
          />
        </Command.Group>

        {issue && (
          <>
            <Command.Group heading={`Issue LIN-${issue.number}`} className={GROUP_HEADING_CLASS}>
              <PaletteItem
                value={`delete issue lin-${issue.number}`}
                icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                label="Delete issue"
                onSelect={deleteIssue}
              />
            </Command.Group>

            <Command.Group heading="Change status" className={GROUP_HEADING_CLASS}>
              {(
                Object.entries(STATUS_META) as [IssueStatus, (typeof STATUS_META)[IssueStatus]][]
              ).map(([value, meta]) => {
                const Icon = meta.icon;
                return (
                  <PaletteItem
                    key={value}
                    value={`status ${meta.label.toLowerCase()}`}
                    icon={<Icon aria-hidden="true" className={`h-4 w-4 ${meta.iconClass}`} />}
                    label={meta.label}
                    disabled={issue.status === value}
                    onSelect={() => changeStatus(value)}
                  />
                );
              })}
            </Command.Group>

            <Command.Group heading="Change priority" className={GROUP_HEADING_CLASS}>
              {(
                Object.entries(PRIORITY_META) as [
                  IssuePriority,
                  (typeof PRIORITY_META)[IssuePriority],
                ][]
              ).map(([value, meta]) => {
                const Icon = meta.icon;
                return (
                  <PaletteItem
                    key={value}
                    value={`priority ${meta.label.toLowerCase()}`}
                    icon={<Icon aria-hidden="true" className={`h-4 w-4 ${meta.iconClass}`} />}
                    label={meta.label}
                    disabled={issue.priority === value}
                    onSelect={() => changePriority(value)}
                  />
                );
              })}
            </Command.Group>

            <Command.Group heading="Assign to" className={GROUP_HEADING_CLASS}>
              <PaletteItem
                value="assign unassigned"
                icon={<UserRound aria-hidden="true" className="h-4 w-4 text-zinc-500" />}
                label="Unassigned"
                disabled={!issue.assignee}
                onSelect={() => assignTo(null)}
              />
              {members?.map((m) => {
                const display = m.name ?? m.email ?? 'Member';
                return (
                  <PaletteItem
                    key={m._id}
                    value={`assign ${display.toLowerCase()}`}
                    icon={
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        {getInitials(display)}
                      </span>
                    }
                    label={display}
                    disabled={issue.assignee?._id === m._id}
                    onSelect={() => assignTo(m._id)}
                  />
                );
              })}
            </Command.Group>

            <Command.Group heading="Toggle label" className={GROUP_HEADING_CLASS}>
              {labels?.map((label) => {
                const isOn = issue.labels.some((l) => l._id === label._id);
                return (
                  <PaletteItem
                    key={label._id}
                    value={`label ${label.name.toLowerCase()}`}
                    icon={
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                    }
                    label={`${isOn ? 'Remove' : 'Add'} ${label.name}`}
                    onSelect={() => toggleLabel(label._id)}
                  />
                );
              })}
            </Command.Group>
          </>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

type PaletteItemProps = {
  value: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: readonly string[];
  disabled?: boolean;
  onSelect: () => void;
};

function PaletteItem({ value, icon, label, shortcut, disabled, onSelect }: PaletteItemProps) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 outline-none data-[disabled=true]:cursor-default data-[disabled=true]:opacity-50 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900 dark:text-zinc-300 dark:data-[selected=true]:bg-zinc-800 dark:data-[selected=true]:text-zinc-100"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="flex shrink-0 gap-1">
          {shortcut.map((key) => (
            <kbd
              key={key}
              className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {key}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}
