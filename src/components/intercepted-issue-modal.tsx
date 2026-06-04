import type { Id } from '../../convex/_generated/dataModel';
import { IssueDetailSlideOver } from './issue-detail-slide-over';

/**
 * Shared wrapper consumed by every `@modal/(.)[id]/page.tsx` intercept (issues, board, ...).
 * Next.js requires the intercepting route file to live under its parent segment so it can't
 * be a single shared file, but the forward logic is identical — centralizing here keeps the
 * route files at three lines.
 */
export function InterceptedIssueModal({ id }: { id: string }) {
  return <IssueDetailSlideOver id={id as Id<'issues'>} />;
}
