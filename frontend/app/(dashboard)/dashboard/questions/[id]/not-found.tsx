import Link from 'next/link';

export default function QuestionNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold">Question not found</h1>
      <p className="mt-2 text-sm text-slate-500">This question doesn&apos;t exist or was removed.</p>
      <Link href="/dashboard/questions" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
        ← Back to all questions
      </Link>
    </div>
  );
}
