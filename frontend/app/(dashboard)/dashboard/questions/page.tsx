import { Suspense } from 'react';
import { QuestionsExplorer } from '@/components/dashboard/QuestionsExplorer';

export const metadata = { title: 'Questions' };

export default function QuestionsPage() {
  return (
    <Suspense>
      <QuestionsExplorer />
    </Suspense>
  );
}
