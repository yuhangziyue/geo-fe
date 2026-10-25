import Link from 'next/link';
import type { ReactNode } from 'react';
import { OWNED_DOMAIN_DISCLAIMER, type Question, type QuestionDetailV3 } from '../types';
import { InfoTip } from './marks';

const BRAND = 'AsterVision';

/** Marks the brand and the products named in the answer. */
function highlight(text: string, terms: string[]): ReactNode[] {
  const escaped = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return [text];
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    terms.includes(part) ? (
      <mark key={i} className="rounded-md bg-brand-subtle px-0.5 font-medium text-brand-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * The answer of one run: excerpt (brand / products marked), citations grouped by domain with the Owned capsule,
 * products linking to the Knowledge Center. `current` marks it as the run this page is about.
 */
export function AnswerCard({
  question: q,
  analysis,
  current = false,
}: {
  question: Question;
  analysis: QuestionDetailV3['analysis'];
  current?: boolean;
}) {
  const n = q.citations.length;
  return (
    <section aria-labelledby="answer-title" className="rounded-xl border border-line bg-surface-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="answer-title" className="text-base font-semibold text-ink">
            Answer on {q.platform}
          </h2>
          <p className="mt-0.5 text-sm text-ink-tertiary">
            {q.date} · tone {q.sentiment} · the dataset keeps an excerpt, not the full answer
          </p>
        </div>
        {current && (
          <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand-ink">This run</span>
        )}
      </header>

      <blockquote className="border-l-4 border-line-strong pl-4 text-ink-secondary">
        {highlight(q.answer_excerpt, [BRAND, ...q.mentioned_products])}
      </blockquote>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            Citations
            <span className="font-normal text-ink-tertiary">
              · {n} {n === 1 ? 'source' : 'sources'} · {analysis.ownedCitations} owned
            </span>
            <InfoTip text={OWNED_DOMAIN_DISCLAIMER} />
          </h3>
          {n === 0 ? (
            <p className="mt-2 text-sm text-ink-tertiary">This answer cites no sources.</p>
          ) : (
            <div className="mt-2 space-y-4">
              {analysis.citationDomains.map((g) => (
                <div key={g.domain}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    <span className="break-all">{g.domain}</span>
                    <span className="text-xs text-ink-tertiary tabular-nums">×{g.count}</span>
                    {g.owned && (
                      <span className="rounded-full bg-owned-subtle px-2 py-0.5 text-xs font-medium text-owned-ink">Owned</span>
                    )}
                  </p>
                  <ul className="mt-1 space-y-1 pl-3 text-sm">
                    {q.citations
                      .filter((c) => hostOf(c.url) === g.domain)
                      .map((c) => (
                        <li key={c.url} className="min-w-0 text-ink-secondary">
                          {c.title}{' '}
                          <span className="ml-1 rounded-full border border-line-strong px-1.5 text-xs text-ink-secondary">
                            {c.source_type}
                          </span>
                          <div className="truncate text-xs text-ink-tertiary">{c.url}</div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-ink-tertiary">{OWNED_DOMAIN_DISCLAIMER}</p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Products mentioned</h3>
          {analysis.products.length === 0 ? (
            <p className="mt-2 text-sm text-ink-tertiary">No specific product named in this answer.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {analysis.products.map((p) => (
                <li key={p.name}>
                  {p.slug ? (
                    <Link href={`/products/${p.slug}`} className="focus-ring rounded-md font-medium text-brand hover:text-brand-hover hover:underline">
                      {p.name} →
                    </Link>
                  ) : (
                    <span className="text-ink-secondary">{p.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
