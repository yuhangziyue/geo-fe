import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { loadQuestions } from '@geo/backend/dashboard/repo';
import { QuestionDetail } from '@/components/dashboard/detail/QuestionDetail';

export const dynamic = 'force-dynamic';

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Existence check on the server so a bad id returns a real 404; the content itself loads from the API.
  if (!/^\d+$/.test(id) || !loadQuestions().some((q) => q.id === Number(id))) notFound();
  return (
    <Suspense>
      <QuestionDetail id={id} />
    </Suspense>
  );
}
