import type { Metadata } from 'next';
import Link from 'next/link';
import { listProducts, listSeries } from '@geo/backend/knowledge/repo';
import { StatusBadge, showResolution } from '@/components/knowledge/StatusBadge';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Browse AsterVision AI video security products by series: Nova, Thermal, Lite, Panoramic and Edge.',
  alternates: { canonical: '/products' },
  openGraph: { title: 'AsterVision Products', type: 'website', url: '/products' },
};

type Props = { searchParams: Promise<{ series?: string; scenario?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const { series: seriesParam, scenario } = await searchParams;
  const seriesList = listSeries();
  const active = seriesList.find((s) => s.slug === seriesParam);
  const products = listProducts({ series: active?.slug, scenario });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        {active ? active.description : 'AI-enabled video security products for retail, warehouse, office, perimeter and industrial monitoring.'}
      </p>

      <nav aria-label="Filter by series" className="mt-6 flex flex-wrap gap-2">
        <Chip href="/products" active={!active} label="All" count={seriesList.reduce((n, s) => n + s.productCount, 0)} />
        {seriesList.map((s) => (
          <Chip key={s.slug} href={`/products?series=${s.slug}`} active={active?.slug === s.slug} label={s.name} count={s.productCount} />
        ))}
      </nav>

      {seriesParam && !active && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Unknown series &quot;{seriesParam}&quot;. Showing all products.
        </p>
      )}

      {scenario && (
        <p className="mt-4 text-sm text-slate-600">
          Scenario: <span className="font-medium">{scenario}</span> · {products.length} product{products.length === 1 ? '' : 's'} ·{' '}
          <Link href="/products" className="text-sky-700 hover:underline">Clear filters</Link>
        </p>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <li key={p.slug}>
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
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'}`}
    >
      {label} <span className={active ? 'text-sky-100' : 'text-slate-400'}>{count}</span>
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
