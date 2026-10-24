import { Suspense } from 'react';
import { Overview } from '@/components/dashboard/Overview';

export const metadata = { title: 'Overview' };

export default function DashboardPage() {
  return (
    <Suspense>
      <Overview />
    </Suspense>
  );
}
