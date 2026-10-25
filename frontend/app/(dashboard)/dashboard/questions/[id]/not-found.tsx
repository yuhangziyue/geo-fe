'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { readListParams } from '@/components/dashboard/list/listParams';
import { useGlobalFilter } from '@/components/dashboard/useGlobalFilter';

const linkCls = 'focus-ring mt-4 inline-block rounded-md text-sm font-medium text-brand hover:text-brand-hover hover:underline';

export default function QuestionNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-surface-card p-8 text-center">
      <h1 className="text-xl font-semibold text-ink">Question not found</h1>
      <p className="mt-2 text-sm text-ink-secondary">This question doesn&apos;t exist or was removed.</p>
      <Suspense
        fallback={
          <Link href="/dashboard/questions" className={linkCls}>
            ← Back to all questions
          </Link>
        }
      >
        <BackLink />
      </Suspense>
    </div>
  );
}

/** Back to the list with the filters the user came with (global + list-only + simulate). */
function BackLink() {
  const search = useSearchParams();
  const { buildHref } = useGlobalFilter();
  return (
    <Link href={buildHref('/dashboard/questions', readListParams(search))} className={linkCls}>
      ← Back to all questions
    </Link>
  );
}
