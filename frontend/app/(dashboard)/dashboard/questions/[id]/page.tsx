import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { findQuestionById } from '@geo/backend/dashboard/repo';
import { QuestionDetail } from '@/components/dashboard/detail/QuestionDetail';

export const dynamic = 'force-dynamic';

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Existence check on the server: a non-numeric or unknown id is a real 404 and renders ./not-found.tsx (with the
  // filtered back link). The content itself loads from the API, so ?simulate=slow|error|empty works as before.
  if (!findQuestionById(id)) notFound();
  return (
    <Suspense>
      <QuestionDetail id={id} />
    </Suspense>
  );
}
