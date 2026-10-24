import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, listSeries } from '@geo/backend/knowledge/repo';
import { ProductForm } from '@/components/knowledge/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Edit product', robots: { index: false, follow: false } };

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();
  const initial = {
    slug: p.slug, name: p.name, seriesSlug: p.series.slug, status: p.status, shortDescription: p.shortDescription, overview: p.overview,
    keyFeatures: p.features.join('\n'), bestFor: p.bestFor.map((b) => b.label).join('\n'),
    resolution: p.specs.resolution ?? '', connectivity: p.specs.connectivity, environment: p.specs.environment, aiFeatures: p.specs.aiFeatures.join('\n'),
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <Link href="/admin/products" className="text-slate-500 hover:text-slate-800">← All products</Link>
        <Link href={`/products/${p.slug}`} className="text-sky-700 hover:underline">View public page →</Link>
      </div>
      <h1 className="text-2xl font-semibold">Edit {p.name}</h1>
      <ProductForm key={p.slug} mode="edit" initial={initial} series={listSeries()} />
    </div>
  );
}
