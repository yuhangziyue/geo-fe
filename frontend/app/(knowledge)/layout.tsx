import type { Metadata } from 'next';
import Link from 'next/link';
import '../globals.css';
import { siteUrl } from '@geo/backend/shared/site';

const SITE_URL = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'AsterVision Product Knowledge Center', template: '%s · AsterVision' },
  description: 'AI-enabled video security products for retail, warehouse, office, perimeter and industrial monitoring.',
};

// Root layout for app 2 (Product Knowledge Center).
export default function KnowledgeRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
            <Link href="/products" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-600 text-xs font-bold text-white">AV</span>
              AsterVision
            </Link>
            <nav className="flex gap-5 text-sm text-slate-600">
              <Link href="/products" className="hover:text-slate-900">Products</Link>
              <Link href="/admin/products" className="hover:text-slate-900">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          AsterVision Product Knowledge Center · Demo data
        </footer>
      </body>
    </html>
  );
}
