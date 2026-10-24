import type { Metadata } from 'next';
import Link from 'next/link';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'AI Visibility Dashboard', template: '%s · AI Visibility' },
  description: 'How AI assistants mention, recommend and cite AsterVision.',
  robots: { index: false, follow: false },
};

// Root layout for app 1 (AI Visibility Dashboard). Internal tool: never indexed.
export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-xs font-bold text-white">AV</span>
              AI Visibility
            </Link>
            <nav className="flex gap-5 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-900">Overview</Link>
              <Link href="/dashboard/questions" className="hover:text-slate-900">Questions</Link>
              <a href="/products" className="hover:text-slate-900">Knowledge Center ↗</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
