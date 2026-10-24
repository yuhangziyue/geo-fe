import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildJsonLd } from '@geo/backend/knowledge/jsonld';
import { getBrand, getProduct, listProducts } from '@geo/backend/knowledge/repo';
import { AskPanel } from '@/components/knowledge/AskPanel';
import { StatusBadge, showResolution } from '@/components/knowledge/StatusBadge';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listProducts({}).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const url = `/products/${p.slug}`;
  return {
    title: `${p.name} – ${p.series.name}`,
    description: p.shortDescription,
    alternates: { canonical: url },
    openGraph: { title: `${p.name} | AsterVision`, description: p.shortDescription, url, type: 'website', siteName: 'AsterVision' },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();
  const jsonLd = buildJsonLd(getBrand(), p, SITE_URL);
  const compare = [{ slug: p.slug, name: p.name, status: p.status, specs: p.specs }, ...p.seriesSiblings];

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap gap-1">
          <li><Link href="/products" className="hover:text-slate-800">Products</Link> /</li>
          <li><Link href={`/products?series=${p.series.slug}`} className="hover:text-slate-800">{p.series.name}</Link> /</li>
          <li aria-current="page" className="text-slate-800">{p.name}</li>
        </ol>
      </nav>

      <header className="mt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
          <StatusBadge status={p.status} />
        </div>
        <p className="mt-2 text-lg text-slate-600">{p.shortDescription}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Section id="overview" title="Overview">
            <p className="text-slate-700">{p.overview}</p>
          </Section>

          <Section id="features" title="Key features">
            <ul className="grid gap-2 sm:grid-cols-2">
              {p.features.map((f) => (
                <li key={f} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">{f}</li>
              ))}
            </ul>
          </Section>

          <Section id="specs" title={`Specs compared across the ${p.series.name}`}>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Resolution</th>
                    <th className="px-3 py-2">Connectivity</th>
                    <th className="px-3 py-2">Environment</th>
                    <th className="px-3 py-2">AI features</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {compare.map((c) => (
                    <tr key={c.slug} className={c.slug === p.slug ? 'bg-sky-50 font-medium' : ''}>
                      <td className="px-3 py-2">
                        {c.slug === p.slug ? c.name : <Link href={`/products/${c.slug}`} className="text-sky-700 hover:underline">{c.name}</Link>}{' '}
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2">{showResolution(c.specs.resolution)}</td>
                      <td className="px-3 py-2">{c.specs.connectivity}</td>
                      <td className="px-3 py-2">{c.specs.environment}</td>
                      <td className="px-3 py-2">{c.specs.aiFeatures.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.specs.resolution === null && <p className="mt-2 text-xs text-slate-500">Resolution N/A: edge devices process video from connected cameras.</p>}
          </Section>

          <Section id="best-for" title="Best for">
            <ul className="flex flex-wrap gap-2">
              {p.bestFor.map((b) => (
                <li key={b.label}>
                  {b.scenarioSlug ? (
                    <Link href={`/scenarios/${b.scenarioSlug}`} title="Matches a defined scenario" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800 ring-1 ring-emerald-200">
                      {b.label} <span className="text-[10px] uppercase tracking-wide">Scenario</span>
                    </Link>
                  ) : (
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{b.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="faq" title="FAQ">
            <dl className="space-y-3">
              {p.faqs.map((f) => (
                <div key={f.id} id={`faq-${f.position}`} className="rounded-md border border-slate-200 bg-white p-4">
                  <dt className="font-medium">{f.question}</dt>
                  <dd className="mt-1 text-sm text-slate-600">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>

        <aside className="space-y-6">
          <AskPanel productSlug={p.slug} productName={p.name} />
          {p.seriesSiblings.length > 0 && (
            <section aria-labelledby="siblings-title" className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 id="siblings-title" className="font-semibold">More in {p.series.name}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {p.seriesSiblings.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/products/${s.slug}`} className="text-sky-700 hover:underline">{s.name}</Link> <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
