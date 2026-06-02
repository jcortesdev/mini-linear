'use client';

import { IssueDetailPanel } from '@/components/issue-detail-panel';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import type { Id } from '../../../../../convex/_generated/dataModel';

export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <div className="h-full">
      <IssueDetailPanel id={id as Id<'issues'>} onClose={() => router.push('/issues')} fullPage />
    </div>
  );
}
