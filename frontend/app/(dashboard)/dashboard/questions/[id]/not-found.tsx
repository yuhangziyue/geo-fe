import Link from 'next/link';

export default function QuestionNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-surface-card p-8 text-center">
      <h1 className="text-xl font-semibold text-ink">Question not found</h1>
      <p className="mt-2 text-sm text-ink-secondary">This question doesn&apos;t exist or was removed.</p>
      <Link href="/dashboard/questions" className="focus-ring mt-4 inline-block rounded-md text-sm font-medium text-brand hover:text-brand-hover hover:underline">
        ← Back to all questions
      </Link>
    </div>
  );
}
