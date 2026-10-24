import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildScenarioJsonLd } from '@geo/backend/knowledge/jsonld';
import { getBrand, getScenario, listScenarios } from '@geo/backend/knowledge/repo';
import { ProductCard } from '@/components/knowledge/ProductCard';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listScenarios().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getScenario(slug);
  if (!s) return { title: 'Scenario not found', robots: { index: false } };
  const url = `/scenarios/${s.slug}`;
  const title = `${s.name} security products`;
  return {
    title,
    description: s.description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | AsterVision`, description: s.description, url, type: 'website', siteName: 'AsterVision' },
  };
}

export default async function ScenarioPage({ params }: Props) {
  const { slug } = await params;
  const s = getScenario(slug);
  if (!s) notFound();
  const jsonLd = buildScenarioJsonLd(getBrand(), s, SITE_URL);
  const others = listScenarios().filter((x) => x.slug !== s.slug);

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/products" className="hover:text-slate-800">Products</Link> / <span className="text-slate-800">Scenarios</span> /{' '}
        <span aria-current="page" className="text-slate-800">{s.name}</span>
      </nav>

      <header className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Scenario</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{s.name}</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">{s.description}</p>
      </header>

      {s.products.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {s.products.map((p) => (
            <li key={p.slug}><ProductCard product={p} /></li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-md bg-slate-100 p-4 text-sm text-slate-600">
          No product lists &quot;{s.name}&quot; under Best For. Products are linked to a scenario only when the names match exactly.
        </p>
      )}

      <section aria-labelledby="other-scenarios" className="mt-12">
        <h2 id="other-scenarios" className="text-lg font-semibold">Other scenarios</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/scenarios/${o.slug}`} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100">{o.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
