import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { loadQuestions } from '@geo/backend/dashboard/repo';
import { QuestionDetailView } from '@/components/dashboard/QuestionDetailView';

export const dynamic = 'force-dynamic';

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Existence check on the server so a bad id returns a real 404; the content itself loads from the API.
  if (!/^\d+$/.test(id) || !loadQuestions().some((q) => q.id === Number(id))) notFound();
  return (
    <Suspense>
      <QuestionDetailView id={id} />
    </Suspense>
  );
}
