import type { Metadata } from 'next';
import Link from 'next/link';
import { listSeries } from '@geo/backend/knowledge/repo';
import { ProductForm, emptyValues } from '@/components/knowledge/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · New product', robots: { index: false, follow: false } };

export default function NewProductPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="text-sm text-slate-500 hover:text-slate-800">← All products</Link>
      <h1 className="text-2xl font-semibold">New product</h1>
      <ProductForm mode="create" initial={emptyValues} series={listSeries()} />
    </div>
  );
}
