'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { AsyncState, Card } from './AsyncState';
import { StatusBadge } from './StatusBadge';
import type { QuestionDetail } from './types';
import { useApi, withSimulate } from './useApi';

const BRAND = 'AsterVision';

function highlight(text: string, terms: string[]): ReactNode[] {
  const escaped = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return [text];
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    terms.includes(part) ? (
      <mark key={i} className="rounded bg-amber-100 px-0.5 font-medium text-amber-900">{part}</mark>
    ) : (
      part
    ),
  );
}

export function QuestionDetailView({ id }: { id: string }) {
  const simulate = useSearchParams().get('simulate');
  const detail = useApi<QuestionDetail>(withSimulate(`/api/dashboard/questions/${id}`, simulate));
  const d = detail.data;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/questions" className="text-sm text-slate-500 hover:text-slate-900">← All questions</Link>
      <AsyncState
        status={detail.status}
        error={detail.error}
        onRetry={detail.retry}
        refreshing={detail.refreshing}
        isEmpty={!!d && !d.question}
        skeletonHeight={320}
        empty={<p>No data for this question.</p>}
      >
        {() => {
          const q = d!.question!;
          const { analysis } = d!;
          return (
            <>
              <div>
                <p className="text-sm text-slate-500">{q.platform} · {q.topic} · {q.date} · Intent {q.intent_type}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">{q.question}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge ok={q.brand_mentioned} yes="Mentioned" no="Not mentioned" />
                  <StatusBadge ok={q.brand_recommended} yes="Recommended" no="Not recommended" />
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600 ring-1 ring-slate-200">
                    Sentiment: {q.sentiment}
                  </span>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <Card title="Answer excerpt" subtitle="The dataset only contains an excerpt of the AI answer, not the full text">
                    <blockquote className="border-l-4 border-indigo-200 pl-4 text-slate-700">
                      {highlight(q.answer_excerpt, [BRAND, ...q.mentioned_products])}
                    </blockquote>
                  </Card>

                  <Card title="Citations" subtitle={`${q.citations.length} ${q.citations.length === 1 ? 'source' : 'sources'} · ${analysis.ownedCitations} on the brand's own domain`}>
                    {q.citations.length === 0 ? (
                      <p className="text-sm text-slate-500">This answer cites no sources.</p>
                    ) : (
                      <div className="space-y-4">
                        {analysis.citationDomains.map((g) => (
                          <div key={g.domain}>
                            <p className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-800">
                              {g.domain}
                              <span className="text-xs text-slate-400">×{g.count}</span>
                              {g.owned && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">Owned</span>}
                            </p>
                            <ul className="space-y-1 pl-3 text-sm">
                              {q.citations
                                .filter((c) => new URL(c.url).hostname === g.domain)
                                .map((c) => (
                                  <li key={c.url} className="text-slate-600">
                                    {c.title} <span className="text-xs text-slate-400">({c.source_type})</span>
                                    <div className="truncate text-xs text-slate-400">{c.url}</div>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card title="Products mentioned" subtitle="Open in the Knowledge Center to improve their content">
                    {analysis.products.length === 0 ? (
                      <p className="text-sm text-slate-500">No specific product named in this answer.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {analysis.products.map((p) => (
                          <li key={p.name}>
                            {p.slug ? (
                              <a href={`/products/${p.slug}`} className="font-medium text-indigo-600 hover:underline">{p.name} →</a>
                            ) : (
                              <span className="text-slate-700">{p.name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  <Card title="Same question on other platforms">
                    {d!.crossPlatform.length === 0 ? (
                      <p className="text-sm text-slate-500">This question was only asked on {q.platform}.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase text-slate-500">
                          <tr><th className="pb-2 font-medium">Platform</th><th className="pb-2 font-medium">Mentioned</th><th className="pb-2 font-medium">Recommended</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {d!.crossPlatform.map((c) => (
                            <tr key={c.id}>
                              <td className="py-2">
                                <Link href={`/dashboard/questions/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600">{c.platform}</Link>
                                <div className="text-xs text-slate-400">{c.date}</div>
                              </td>
                              <td className="py-2"><StatusBadge ok={c.mentioned} yes="Yes" no="No" /></td>
                              <td className="py-2"><StatusBadge ok={c.recommended} yes="Yes" no="No" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </div>
              </div>
            </>
          );
        }}
      </AsyncState>
    </div>
  );
}
