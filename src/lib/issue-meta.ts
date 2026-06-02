import {
  AlertTriangle,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleEllipsis,
  CircleSlash,
  type LucideIcon,
  Minus,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from 'lucide-react';
import type { ISSUE_PRIORITY, ISSUE_STATUS } from '../../convex/schema';

export type IssueStatus = (typeof ISSUE_STATUS)[number];
export type IssuePriority = (typeof ISSUE_PRIORITY)[number];

type StatusMeta = {
  label: string;
  icon: LucideIcon;
  iconClass: string;
};

export const STATUS_META: Record<IssueStatus, StatusMeta> = {
  backlog: {
    label: 'Backlog',
    icon: CircleDashed,
    iconClass: 'text-zinc-400 dark:text-zinc-500',
  },
  todo: {
    label: 'Todo',
    icon: Circle,
    iconClass: 'text-zinc-500 dark:text-zinc-400',
  },
  in_progress: {
    label: 'In progress',
    icon: CircleDot,
    iconClass: 'text-yellow-500',
  },
  in_review: {
    label: 'In review',
    icon: CircleEllipsis,
    iconClass: 'text-violet-500',
  },
  done: {
    label: 'Done',
    icon: CircleCheck,
    iconClass: 'text-emerald-500',
  },
  canceled: {
    label: 'Canceled',
    icon: CircleSlash,
    iconClass: 'text-zinc-400 dark:text-zinc-500',
  },
};

type PriorityMeta = {
  label: string;
  icon: LucideIcon;
  iconClass: string;
};

export const PRIORITY_META: Record<IssuePriority, PriorityMeta> = {
  no_priority: {
    label: 'No priority',
    icon: Minus,
    iconClass: 'text-zinc-400 dark:text-zinc-500',
  },
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    iconClass: 'text-red-500',
  },
  high: {
    label: 'High',
    icon: SignalHigh,
    iconClass: 'text-zinc-700 dark:text-zinc-300',
  },
  medium: {
    label: 'Medium',
    icon: SignalMedium,
    iconClass: 'text-zinc-500 dark:text-zinc-400',
  },
  low: {
    label: 'Low',
    icon: SignalLow,
    iconClass: 'text-zinc-500 dark:text-zinc-400',
  },
};

export function getInitials(input: string | null | undefined): string {
  if (!input) return '?';
  const trimmed = input.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}
