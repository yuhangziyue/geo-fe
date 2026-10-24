import type { Metadata } from 'next';
import Link from 'next/link';
import { AskPanel } from '@/components/knowledge/AskPanel';
import { listProducts, listSeries } from '@geo/backend/knowledge/repo';
import { ProductCard } from '@/components/knowledge/ProductCard';

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

      <div className="mt-6">
        <AskPanel />
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <li key={p.slug}>
            <ProductCard product={p} />
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
