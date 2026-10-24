import Link from 'next/link';
import type { ProductSummary } from '@geo/backend/knowledge/schema';
import { StatusBadge, showResolution } from './StatusBadge';

// Shared by the product list and scenario pages.
export function ProductCard({ product: p }: { product: ProductSummary }) {
  return (
    <Link href={`/products/${p.slug}`} className="block h-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{p.series.name}</span>
        <StatusBadge status={p.status} />
      </div>
      <h2 className="mt-2 text-lg font-semibold">{p.name}</h2>
      <p className="mt-1 text-sm text-slate-600">{p.shortDescription}</p>
      <ul aria-label="Key features" className="mt-3 flex flex-wrap gap-1.5">
        {p.features.map((f) => (
          <li key={f} className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-800 ring-1 ring-inset ring-sky-200">{f}</li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Spec label="Resolution" value={showResolution(p.specs.resolution)} />
        <Spec label="Connectivity" value={p.specs.connectivity} />
        <Spec label="Environment" value={p.specs.environment} />
      </dl>
    </Link>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
