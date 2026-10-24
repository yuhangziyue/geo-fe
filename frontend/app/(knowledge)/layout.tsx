import '../globals.css';

// Placeholder root layout for app 2 (Knowledge Center); replaced in Task 2.
export default function KnowledgeRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
