'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AsyncState } from './AsyncState';
import { StatusBadge } from './StatusBadge';
import type { QuestionPage } from './types';
import { useApi, withSimulate } from './useApi';

const FILTER_KEYS = ['platform', 'mentioned', 'recommended', 'topic', 'intent', 'q'] as const;
const selectCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** Question list. Every filter lives in the URL query, so views are shareable and back/forward works. */
export function QuestionsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  const list = useApi<QuestionPage>(`/api/dashboard/questions${qs ? `?${qs}` : ''}`);
  const [keyword, setKeyword] = useState(search.get('q') ?? '');

  useEffect(() => setKeyword(search.get('q') ?? ''), [search]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };
  const clearFilters = () => {
    const next = new URLSearchParams();
    const sim = search.get('simulate');
    if (sim) next.set('simulate', sim);
    router.push(next.size ? `${pathname}?${next}` : pathname);
  };
  const hasFilters = FILTER_KEYS.some((k) => search.get(k));
  const data = list.data;
  // Options come from the API; until the first response, keep whatever the URL already selects visible.
  const optionsFor = (key: 'platform' | 'topic' | 'intent', all?: string[]) => all ?? [search.get(key)].filter((v): v is string => !!v);
  const platforms = optionsFor('platform', data?.facets.platforms);
  const topics = optionsFor('topic', data?.facets.topics);
  const intents = optionsFor('intent', data?.facets.intents);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
        <p className="mt-1 text-sm text-slate-500">Every question asked to an AI assistant and how the brand showed up in the answer.</p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setParam('q', keyword.trim());
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Platform
          <select className={selectCls} value={search.get('platform') ?? ''} onChange={(e) => setParam('platform', e.target.value)}>
            <option value="">All</option>
            {platforms.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Topic
          <select className={selectCls} value={search.get('topic') ?? ''} onChange={(e) => setParam('topic', e.target.value)}>
            <option value="">All</option>
            {topics.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Intent
          <select className={selectCls} value={search.get('intent') ?? ''} onChange={(e) => setParam('intent', e.target.value)}>
            <option value="">All</option>
            {intents.map((i) => <option key={i} value={i}>Intent {i}</option>)}
          </select>
        </label>
        {(['mentioned', 'recommended'] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-medium capitalize text-slate-500">
            {k}
            <select className={selectCls} value={search.get(k) ?? ''} onChange={(e) => setParam(k, e.target.value)}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
        ))}
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
          Keyword
          <input
            className={selectCls}
            placeholder="Search question, answer, product, source…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
        <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
          Search
        </button>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="px-2 py-1.5 text-sm text-slate-600 hover:text-slate-900">
            Clear filters
          </button>
        )}
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <AsyncState
          status={list.status}
          error={list.error}
          onRetry={list.retry}
          refreshing={list.refreshing}
          isEmpty={!!data && data.total === 0}
          skeletonHeight={300}
          empty={
            <>
              <p className="font-medium text-slate-700">No questions match these filters.</p>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
                  Clear filters
                </button>
              )}
            </>
          }
        >
          {() => (
            <>
              <p className="mb-3 text-sm text-slate-500">{data!.total} questions</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Question</th>
                      <th className="py-2 pr-4 font-medium">Platform</th>
                      <th className="py-2 pr-4 font-medium">Mentioned</th>
                      <th className="py-2 pr-4 font-medium">Recommended</th>
                      <th className="py-2 pr-4 font-medium">Answer excerpt</th>
                      <th className="py-2 text-right font-medium">Citations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data!.items.map((q) => (
                      <tr key={q.id} className="align-top hover:bg-slate-50">
                        <td className="py-3 pr-4">
                          <Link href={`/dashboard/questions/${q.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                            {q.question}
                          </Link>
                          <div className="mt-0.5 text-xs text-slate-500">{q.topic} · Intent {q.intent_type} · {q.date}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">{q.platform}</td>
                        <td className="py-3 pr-4"><StatusBadge ok={q.brand_mentioned} yes="Yes" no="No" /></td>
                        <td className="py-3 pr-4"><StatusBadge ok={q.brand_recommended} yes="Yes" no="No" /></td>
                        <td className="max-w-md py-3 pr-4 text-slate-600"><p className="line-clamp-2">{q.answer_excerpt}</p></td>
                        <td className="py-3 text-right tabular-nums">{q.citations.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Page {data!.page} of {pages}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={data!.page <= 1} onClick={() => setParam('page', String(data!.page - 1))} className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">Previous</button>
                    <button type="button" disabled={data!.page >= pages} onClick={() => setParam('page', String(data!.page + 1))} className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </AsyncState>
      </div>
    </div>
  );
}
