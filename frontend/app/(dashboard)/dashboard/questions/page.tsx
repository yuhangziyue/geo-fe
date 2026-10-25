import { Suspense } from 'react';
import { QuestionsTable } from '@/components/dashboard/list/QuestionsTable';

export const metadata = { title: 'Questions' };

export default function QuestionsPage() {
  return (
    <Suspense>
      <QuestionsTable />
    </Suspense>
  );
}
