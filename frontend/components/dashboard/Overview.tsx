'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { AsyncState, Card } from './AsyncState';
import { EChart } from './EChart';
import { InsightPanel } from './InsightPanel';
import { PLATFORMS, type Summary } from './types';
import { useApi, withSimulate } from './useApi';

const WEAK_TOPIC_COLOR = '#e11d48';
const BASE_COLOR = '#6366f1';

function KpiCard({ label, value, hint, sub }: { label: string; value: string; hint: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" title={hint}>
      <p className="flex items-center gap-1 text-sm font-medium text-slate-500">
        {label}
        <span aria-label={hint} className="cursor-help text-slate-400">ⓘ</span>
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub ?? hint}</p>
    </div>
  );
}

export function Overview() {
  const router = useRouter();
  const search = useSearchParams();
  const simulate = search.get('simulate');
  const [platform, setPlatform] = useState('');
  const url = withSimulate(`/api/dashboard/summary${platform ? `?platform=${platform}` : ''}`, simulate);
  const summary = useApi<Summary>(url);
  const data = summary.data;

  const platformOption = useMemo<EChartsOption | null>(() => {
    if (!data) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 40, right: 48, top: 40, bottom: 48 },
      xAxis: { type: 'category', data: data.platforms.map((p) => p.name) },
      yAxis: [
        { type: 'value', name: 'Count' },
        { type: 'value', name: 'Visibility %', max: 100, axisLabel: { formatter: '{value}%' } },
      ],
      series: [
        { name: 'Mentions', type: 'bar', data: data.platforms.map((p) => p.mentions), itemStyle: { color: '#a5b4fc' } },
        { name: 'Recommendations', type: 'bar', data: data.platforms.map((p) => p.recommendations), itemStyle: { color: BASE_COLOR } },
        { name: 'Citations', type: 'bar', data: data.platforms.map((p) => p.citations), itemStyle: { color: '#94a3b8' } },
        {
          name: 'Visibility %',
          type: 'line',
          yAxisIndex: 1,
          data: data.platforms.map((p) => p.visibility),
          itemStyle: { color: '#f59e0b' },
          label: { show: true, formatter: '{c}%' },
        },
      ],
    };
  }, [data]);

  const trendOption = useMemo<EChartsOption | null>(() => {
    if (!data) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 40, right: 48, top: 40, bottom: 48 },
      xAxis: { type: 'category', data: data.trend.map((t) => t.date.slice(5)) },
      yAxis: [
        { type: 'value', name: 'Count', minInterval: 1 },
        { type: 'value', name: 'Visibility %', max: 100, axisLabel: { formatter: '{value}%' } },
      ],
      series: [
        { name: 'Mentions', type: 'line', data: data.trend.map((t) => t.mentions), itemStyle: { color: '#a5b4fc' } },
        { name: 'Recommendations', type: 'line', data: data.trend.map((t) => t.recommendations), itemStyle: { color: BASE_COLOR } },
        { name: 'Visibility %', type: 'line', yAxisIndex: 1, smooth: true, data: data.trend.map((t) => t.visibility), itemStyle: { color: '#f59e0b' } },
      ],
    };
  }, [data]);

  const topicOption = useMemo<EChartsOption | null>(() => {
    if (!data) return null;
    const topics = [...data.topics].sort((a, b) => a.visibility - b.visibility);
    const min = Math.min(...topics.map((t) => t.visibility));
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (p: unknown) => {
          const t = topics[(p as Array<{ dataIndex: number }>)[0].dataIndex];
          return `${t.topic}<br/>Visibility ${t.visibility}%<br/>${t.recommendations} recommendations / ${t.questions} questions`;
        },
      },
      grid: { left: 150, right: 40, top: 8, bottom: 24 },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: { type: 'category', data: topics.map((t) => t.topic) },
      series: [
        {
          type: 'bar',
          data: topics.map((t) => ({ value: t.visibility, itemStyle: { color: t.visibility === min ? WEAK_TOPIC_COLOR : BASE_COLOR } })),
          label: { show: true, position: 'right', formatter: '{c}%' },
        },
      ],
    };
  }, [data]);

  const k = data?.kpi;
  const citedPct = k && k.questions ? Math.round((k.citedQuestions / k.questions) * 100) : 0;

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
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      <AsyncState
        status={summary.status}
        error={summary.error}
        onRetry={summary.retry}
        isEmpty={!!k && k.questions === 0}
        skeletonHeight={110}
        empty={<p>No questions were analyzed for this selection.</p>}
      >
        {() => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Visibility" value={`${k!.visibility}%`} hint="Visibility = mention rate (questions mentioning the brand ÷ questions analyzed)" sub={`${k!.mentions} of ${k!.questions} questions mention the brand`} />
            <KpiCard label="Mentions" value={String(k!.mentions)} hint="Questions whose answer mentions the brand" />
            <KpiCard label="Recommendations" value={String(k!.recommendations)} hint="Questions whose answer recommends the brand" sub={`${k!.mentions - k!.recommendations} mentions without a recommendation`} />
            <KpiCard label="Citations" value={String(k!.citations)} hint="Total cited sources across all answers" sub={`${k!.citations} citations · ${k!.citedQuestions} questions (${citedPct}%)`} />
          </div>
        )}
      </AsyncState>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By platform" subtitle="Click a platform to see its questions">
          <AsyncState status={summary.status} error={summary.error} onRetry={summary.retry} isEmpty={!!data && data.platforms.length === 0}>
            {() => (
              <EChart
                ariaLabel="Mentions, recommendations, citations and visibility by platform"
                option={platformOption!}
                onClick={({ name }) => router.push(`/dashboard/questions?platform=${encodeURIComponent(name)}`)}
              />
            )}
          </AsyncState>
        </Card>
        <Card title="Daily trend" subtitle="Mentions, recommendations and visibility per day">
          <AsyncState status={summary.status} error={summary.error} onRetry={summary.retry} isEmpty={!!data && data.trend.length === 0}>
            {() => <EChart ariaLabel="Daily visibility trend" option={trendOption!} />}
          </AsyncState>
        </Card>
        <Card title="Visibility by topic" subtitle="Weakest topic highlighted · click a bar to drill down">
          <AsyncState status={summary.status} error={summary.error} onRetry={summary.retry} isEmpty={!!data && data.topics.length === 0}>
            {() => (
              <EChart
                ariaLabel="Visibility by topic"
                option={topicOption!}
                onClick={({ name }) => router.push(`/dashboard/questions?topic=${encodeURIComponent(name)}`)}
              />
            )}
          </AsyncState>
        </Card>
        <Card title="Questions to fix first" subtitle="Not mentioned first, then mentioned but not recommended">
          <AsyncState
            status={summary.status}
            error={summary.error}
            onRetry={summary.retry}
            isEmpty={!!data && data.worstQuestions.length === 0}
            empty={<p>Every question in this selection recommends the brand.</p>}
          >
            {() => (
              <ul className="divide-y divide-slate-100">
                {data!.worstQuestions.map((w) => (
                  <li key={w.id}>
                    <Link href={`/dashboard/questions/${w.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                      <span className="text-sm text-slate-800">{w.question}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {w.platform} · {w.topic}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AsyncState>
        </Card>
      </div>

      <InsightPanel platform={platform} simulate={simulate} />
    </div>
  );
}
