'use client';

import type { ReactNode } from 'react';

interface Props {
  status: 'loading' | 'error' | 'ok';
  error?: string | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  empty?: ReactNode;
  skeletonHeight?: number;
  children: () => ReactNode;
}

/** One wrapper for the three async states every data block must handle. */
export function AsyncState({ status, error, isEmpty, onRetry, empty, skeletonHeight = 160, children }: Props) {
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading" className="animate-pulse space-y-3" style={{ minHeight: skeletonHeight }}>
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
        <p className="font-medium text-rose-800">Couldn&apos;t load this section</p>
        <p className="text-rose-700">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-rose-300 bg-white px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        {empty ?? <p>No data for this selection.</p>}
      </div>
    );
  }
  return <>{children()}</>;
}

export function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
