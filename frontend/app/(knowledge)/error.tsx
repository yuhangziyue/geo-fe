'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Catches render errors in Knowledge Center pages (inside its root layout, so header and footer stay).
export default function KnowledgeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="py-24 text-center">
      <p className="text-sm font-medium text-rose-600">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold">This page could not be loaded</h1>
      <p className="mt-2 text-slate-600">
        Try again, or browse the product list.{error.digest && <span className="block text-xs text-slate-400">Reference: {error.digest}</span>}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          Try again
        </button>
        <Link href="/products" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Browse all products
        </Link>
      </div>
    </div>
  );
}
