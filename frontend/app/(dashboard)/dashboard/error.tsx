'use client';

import { useEffect } from 'react';

// Render errors in a dashboard view. Data errors never reach here: each block shows its own Error state with Retry.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-line bg-danger-subtle p-8 text-center">
      <h1 className="text-lg font-semibold text-danger">This view crashed</h1>
      <p className="mt-2 text-sm text-danger">{error.message || 'Unexpected error.'}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md border border-line-strong bg-surface-card px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-subtle">
        Try again
      </button>
    </div>
  );
}
