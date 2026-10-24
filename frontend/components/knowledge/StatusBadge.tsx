export function StatusBadge({ status }: { status: 'active' | 'beta' }) {
  if (status !== 'beta') return null;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Beta</span>;
}

export const showResolution = (r: string | null) => r ?? 'N/A';
