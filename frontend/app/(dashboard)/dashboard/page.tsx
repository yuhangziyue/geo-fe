import { Suspense } from 'react';
import { DashboardHome } from '@/components/dashboard/home/DashboardHome';

export const metadata = { title: 'Overview' };

// The home reads the global filter from the URL (useSearchParams), hence the Suspense boundary.
export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardHome />
    </Suspense>
  );
}
