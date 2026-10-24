'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { AsyncState, Card } from './AsyncState';
import { platformChart, topicChart, trendChart } from './charts';
import { EChart } from './EChart';
import { InsightPanel } from './InsightPanel';
import { IntentCards } from './IntentCards';
import { KpiRow } from './KpiRow';
import { questionsHref } from './links';
import type { SummaryV2 as Summary } from './types';
import { useApi, withSimulate } from './useApi';

/** Overview page: owns the URL filter and the one summary request; every block below renders from it. */
export function Overview() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const simulate = search.get('simulate');
  // Lives in the URL like every other dashboard filter: survives refresh, shareable, back/forward works.
  const platform = search.get('platform') ?? '';
  const url = withSimulate(`/api/dashboard/summary${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`, simulate);
  const summary = useApi<Summary>(url);
  const data = summary.data;

  const setPlatform = (value: string) => {
    const next = new URLSearchParams(search.toString());
    if (value) next.set('platform', value);
    else next.delete('platform');
    router.push(next.size ? `${pathname}?${next}` : pathname);
  };

  const charts = useMemo(
    () => (data ? { platform: platformChart(data), trend: trendChart(data), topic: topicChart(data) } : null),
    [data],
  );
  const weakestTopic = data?.topics.length ? data.topics.reduce((a, b) => (b.visibility < a.visibility ? b : a)) : null;
  // Shared by every block: they all render from the same request.
  const async = { status: summary.status, error: summary.error, onRetry: summary.retry, refreshing: summary.refreshing };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data?.brand ?? 'AsterVision'} · AI Visibility</h1>
          <p className="mt-1 text-sm text-slate-500">
            How AI assistants mention, recommend and cite the brand{data ? ` · ${data.period.replace('~', ' – ')}` : ''}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All platforms</option>
            {(data?.facets.platforms ?? (platform ? [platform] : [])).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      <AsyncState
        {...async}
        isEmpty={!!data && data.kpi.questions === 0}
        skeletonHeight={110}
        empty={<p>No questions were analyzed for this selection.</p>}
      >
        {() => <KpiRow data={data!} />}
      </AsyncState>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By platform" subtitle="Click a platform to see its questions">
          <AsyncState {...async} isEmpty={!!data && data.platforms.length === 0}>
            {() => (
              <EChart
                ariaLabel="Mentions, recommendations, citations and visibility by platform"
                {...charts!.platform}
                onClick={({ name }) => router.push(questionsHref(search, { platform: name }))}
              />
            )}
          </AsyncState>
        </Card>
        <Card title="Daily trend" subtitle="Mentions, recommendations and visibility per day">
          <AsyncState {...async} isEmpty={!!data && data.trend.length === 0}>
            {() => <EChart ariaLabel="Daily visibility trend" {...charts!.trend} />}
          </AsyncState>
        </Card>
        <Card title="Visibility by topic" subtitle="Weakest topic highlighted · click a bar to drill down">
          <AsyncState {...async} isEmpty={!!data && data.topics.length === 0}>
            {() => (
              <EChart
                ariaLabel="Visibility by topic"
                {...charts!.topic}
                onClick={({ name }) => router.push(questionsHref(search, { topic: name }))}
              />
            )}
          </AsyncState>
          {weakestTopic && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
              Weakest: <span className="font-medium text-slate-800">{weakestTopic.topic}</span>
              {' · '}
              {weakestTopic.scenario ? (
                // Another app (own root layout): a plain link, not next/link.
                <a href={`/scenarios/${weakestTopic.scenario.slug}`} className="font-medium text-indigo-600 hover:underline">
                  improve the {weakestTopic.scenario.name} scenario page ↗
                </a>
              ) : (
                <span>no scenario page covers this topic yet</span>
              )}
            </p>
          )}
        </Card>
        <Card title="Prompts to fix first" subtitle="One entry per prompt · never mentioned first, then mentioned but not recommended">
          <AsyncState
            {...async}
            isEmpty={!!data && data.worstQuestions.length === 0}
            empty={<p>Every question in this selection recommends the brand.</p>}
          >
            {() => (
              <ul className="divide-y divide-slate-100">
                {data!.worstQuestions.map((w) => (
                  <li key={w.id}>
                    <Link href={`/dashboard/questions/${w.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                      <span className="text-sm text-slate-800">{w.question}</span>
                      <span className="shrink-0 text-right text-xs text-slate-500">
                        {w.platforms.join(', ')} · {w.topic}
                        <span className="block">{w.badRuns} of {w.runs} runs fall short</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AsyncState>
        </Card>
      </div>

      <Card title="By intent type" subtitle="Intent labels come from the dataset, which does not define them · click to drill down">
        <AsyncState {...async} isEmpty={!!data && data.intents.length === 0}>
          {() => <IntentCards data={data!} hrefFor={(intent) => questionsHref(search, { intent })} />}
        </AsyncState>
      </Card>

      {/* Keyed by the filter: insights computed for another selection must not linger on screen. */}
      <InsightPanel key={`${platform}|${simulate ?? ''}`} platform={platform} simulate={simulate} />
    </div>
  );
}
