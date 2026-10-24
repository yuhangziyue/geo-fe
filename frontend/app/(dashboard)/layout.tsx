import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Placeholder root layout for app 1 (Visibility Dashboard); replaced in Task 1.
export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
