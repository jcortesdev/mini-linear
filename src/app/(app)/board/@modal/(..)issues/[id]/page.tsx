import { InterceptedIssueModal } from '@/components/intercepted-issue-modal';

export default async function InterceptedIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterceptedIssueModal id={id} />;
}
