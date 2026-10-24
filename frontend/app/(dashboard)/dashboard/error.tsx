'use client';

import { useEffect } from 'react';

// Render errors in a dashboard view. Data errors never reach here: each block shows its own Error state with Retry.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
      <h1 className="text-lg font-semibold text-rose-900">This view crashed</h1>
      <p className="mt-2 text-sm text-rose-700">{error.message || 'Unexpected error.'}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100">
        Try again
      </button>
    </div>
  );
}
