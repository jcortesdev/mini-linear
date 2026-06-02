import { IssueDetailSlideOver } from '@/components/issue-detail-slide-over';
import type { Id } from '../../../../../../convex/_generated/dataModel';

export default async function InterceptedIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IssueDetailSlideOver id={id as Id<'issues'>} />;
}
