import type { Metadata } from 'next';
import Link from 'next/link';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import '../globals.css';
import { color } from '../../design/tokens';

export const metadata: Metadata = {
  title: { default: 'AI Visibility Dashboard', template: '%s · AI Visibility' },
  description: 'How AI assistants mention, recommend and cite AsterVision.',
  robots: { index: false, follow: false },
};

const navLink = 'focus-ring shrink-0 rounded-md text-ink-secondary transition-colors duration-[120ms] ease-out hover:text-ink';

// Root layout for app 1 (AI Visibility Dashboard). Internal tool: never indexed.
// 375 (06 §6): below sm the wordmark collapses to the "AV" badge so all three nav links fit without
// scrolling; overflow-x-auto stays as a safety net for narrower viewports.
export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-page text-ink">
        <AntdRegistry>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: color.brand.DEFAULT,
                colorPrimaryHover: color.brand.hover,
                colorPrimaryActive: color.brand.hover,
                colorText: color.ink.DEFAULT,
                colorTextSecondary: color.ink.secondary,
                colorTextTertiary: color.ink.tertiary,
                colorBgLayout: color.surface.page,
                colorBgContainer: color.surface.card,
                colorBgElevated: color.surface.card,
                colorBorder: color.line.DEFAULT,
                colorBorderSecondary: color.line.strong,
                colorSuccess: color.positive.DEFAULT,
                colorWarning: color.warning.DEFAULT,
                colorError: color.danger.DEFAULT,
                colorLink: color.brand.DEFAULT,
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: 14,
              },
            }}
          >
            <header className="border-b border-line bg-surface-card">
              <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
                <Link href="/dashboard" className="focus-ring flex shrink-0 items-center gap-2 rounded-md font-semibold text-ink">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-xs font-semibold text-brand-on">AV</span>
                  <span className="hidden sm:inline">AI Visibility</span>
                </Link>
                <nav aria-label="Main" className="flex min-w-0 gap-4 overflow-x-auto whitespace-nowrap py-2 text-sm sm:gap-5">
                  <Link href="/dashboard" className={navLink}>Overview</Link>
                  <Link href="/dashboard/questions" className={navLink}>Questions</Link>
                  {/* Another root layout: navigation is a full page load either way, so a plain link says so honestly. */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href="/products" className={navLink}>Knowledge Center ↗</a>
                </nav>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
