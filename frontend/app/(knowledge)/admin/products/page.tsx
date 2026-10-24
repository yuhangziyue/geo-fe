import type { Metadata } from 'next';
import Link from 'next/link';
import { listProducts } from '@geo/backend/knowledge/repo';
import { StatusBadge } from '@/components/knowledge/StatusBadge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Products', robots: { index: false, follow: false } };

export default function AdminProductsPage() {
  const products = listProducts({});
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products <span className="text-base font-normal text-slate-500">({products.length})</span></h1>
        <Link href="/admin/products/new" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">New product</Link>
      </div>
      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Slug</th><th className="px-4 py-2">Series</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.slug}>
                <td className="px-4 py-2 font-medium">{p.name} <StatusBadge status={p.status} /></td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{p.slug}</td>
                <td className="px-4 py-2">{p.series.name}</td>
                <td className="space-x-3 px-4 py-2 text-right">
                  <Link href={`/products/${p.slug}`} className="text-slate-600 hover:underline">View</Link>
                  <Link href={`/admin/products/${p.slug}/edit`} className="text-sky-700 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
