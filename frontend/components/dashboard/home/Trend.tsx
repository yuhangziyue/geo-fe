'use client';

import type { EChartsOption } from 'echarts';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Tabs } from 'antd';
import { palette, series } from '../../../design/chartTheme';
import { AsyncState, Card } from '../AsyncState';
import { EChart, type ChartTable } from '../EChart';
import type { AttributionRow, AttributionShift, AttributionVerdict, PlatformTrends, Summary, TrendPoint } from '../types';
import { PLATFORMS } from '../types';
import { useGlobalFilter } from '../useGlobalFilter';
import { asyncProps, ClearFilters, Delta, formatDay, useIsNarrow, type SummaryApi } from './shared';
import {
  asOfStamp,
  consoleTrendOption,
  consoleTrendTable,
  latestWindowN,
  platformTrendOption,
} from './trendCharts';

/** 05 §3 intent teal: A is the darker of the two, C the lighter — the only two tiers with enough samples to draw. */
const INTENT_LINE_COLOR = { A: '#14B8A6', C: '#2DD4BF' } as const;

/** 100 % stacked shift segments: A / C keep the teal family, B is the darker teal, S (no questions) is neutral. */
const INTENT_SHIFT_COLOR = { A: '#14B8A6', B: '#0D9488', C: '#2DD4BF', S: series.neutral } as const;

/** Verdict column text (05 §3). */
const VERDICT_TEXT: Record<AttributionVerdict, string> = {
  signal: 'Signal',
  within_error: 'Within sample error',
  too_few_samples: 'Too few samples',
};

/**
 * ④-right 7-day rolling visibility (05 §2.5, 06 §5.4), plus the 05 §3 Attribution view:
 * half-to-half delta ranking tables (platform / intent), 100 % stacked mention-share migration bars and the
 * A / C sub-trend lines. The rolling line is the signal (no smoothing, no markers, absent while the window is
 * not full); daily values are faint dots because a day is only a handful of questions. The `By` switch is local
 * state only — like the Chart/Table toggle, it never writes the URL.
 */
export function Trend({ api }: { api: SummaryApi }) {
  const narrow = useIsNarrow();
  const points = api.data?.trend;
  const [by, setBy] = useState<'overall' | 'attribution'>('overall');
  const [dimension, setDimension] = useState<'platform' | 'intent'>('platform');

  const chart = useMemo(
    () => (points ? { option: consoleTrendOption(points, narrow), table: consoleTrendTable(points) } : null),
    [points, narrow],
  );
  const hasRolling = !!points?.some((p) => p.rollingVisibility !== null);
  const sizes = [...new Set((points ?? []).filter((p) => p.dailyN > 0).map((p) => p.dailyN))];
  const sampleNote =
    sizes.length === 1 ? `daily samples are only ${sizes[0]} questions` : `daily samples are only ${Math.min(...sizes)}–${Math.max(...sizes)} questions`;

  // The console material belongs to the live Overall signal only; loading / error / empty and the analytical
  // Attribution pane stay on the light card (also what keeps cyan and teal on separate axes).
  const hasData = !!points && points.some((p) => p.dailyN > 0);
  const consoleTone = by === 'overall' && api.status === 'ok' && hasData;

  return (
    <Card
      title="Visibility trend"
      subtitle={
        by === 'overall'
          ? points && sizes.length > 0
            ? `7-day rolling · ${sampleNote}${hasRolling ? '' : ' · Not enough days for a rolling line'}`
            : '7-day rolling'
          : 'First half vs second half · signal = a change of at least one row of observations'
      }
      tone={consoleTone ? 'console' : 'default'}
      action={
        <div className={`flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3 ${consoleTone ? 'console-tabs' : ''}`}>
          {consoleTone && points && <DataCutoffStamp date={points[points.length - 1].date} />}
          <Tabs
            aria-label="Trend view"
            size="small"
            activeKey={by}
            onChange={(key) => setBy(key as 'overall' | 'attribution')}
            styles={{ header: { marginBottom: 0 } }}
            items={[
              { key: 'overall', label: 'Overall' },
              { key: 'attribution', label: 'Attribution' },
            ]}
          />
        </div>
      }
    >
      <AsyncState
        {...asyncProps(api)}
        isEmpty={!!points && points.every((p) => p.dailyN === 0)}
        skeletonHeight={300}
        empty={
          <>
            <p>No questions match these filters.</p>
            <ClearFilters />
          </>
        }
      >
        {() =>
          by === 'overall' ? (
            <EChart
              ariaLabel="7-day rolling visibility with daily values"
              height={300}
              option={chart!.option}
              table={chart!.table}
              theme={consoleTone ? 'geoConsole' : 'geo'}
              tone={consoleTone ? 'console' : 'light'}
            />
          ) : (
            <AttributionView data={api.data!} narrow={narrow} dimension={dimension} onDimension={setDimension} />
          )
        }
      </AsyncState>
    </Card>
  );
}

/**
 * Static data-cutoff marker (docs §2 / §5.2): "● LIVE · as of Aug 30" — a nightly-snapshot timestamp, not a
 * polling indicator (no timer, no refresh). Title text rides with the card so the distinction survives demos.
 */
function DataCutoffStamp({ date }: { date: string }) {
  const day = formatDay(date);
  return (
    <span
      aria-label={`Live, data through ${day}. Static snapshot marker, not a live feed.`}
      title={`Data through ${day} — latest nightly snapshot. Static cutoff marker; this does not poll or refresh.`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-console px-2 py-0.5 text-xs text-ink-on-console"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal-on-dark" />
      <span aria-hidden>LIVE · {asOfStamp(date)}</span>
    </span>
  );
}

/** Attribution view (05 §3): Platform = delta ranking table + shift bars; Intent = A/C lines + table + footnote + shift bars. */
function AttributionView({
  data,
  narrow,
  dimension,
  onDimension,
}: {
  data: Summary;
  narrow: boolean;
  dimension: 'platform' | 'intent';
  onDimension: (d: 'platform' | 'intent') => void;
}) {
  const byPlatform = data.attribution.byPlatform;
  const byIntent = data.attribution.byIntent;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Tabs
          aria-label="Attribution dimension"
          size="small"
          activeKey={dimension}
          onChange={(key) => onDimension(key as 'platform' | 'intent')}
          styles={{ header: { marginBottom: 0 } }}
          items={[
            { key: 'platform', label: 'Platform' },
            { key: 'intent', label: 'Intent' },
          ]}
        />
      </div>
      {dimension === 'platform' ? (
        <>
          <PlatformSmallMultiples trends={data.platformTrends} narrow={narrow} />
          <AttributionTable rows={byPlatform.rows} filterKey="platform" />
          <ShiftChart
            shift={byPlatform.shift}
            colorOf={(label, i) => palette[i % palette.length]}
            ariaLabel="First vs second half mention share by platform"
            caption="First vs second half mention share by platform"
            height={140}
          />
          {/* Last in DOM on purpose: keeps the visible ranking table the first table for users/selectors. */}
          <PlatformTrendsTable trends={data.platformTrends} />
        </>
      ) : (
        <>
          <IntentTrendChart a={data.intentTrends.A} c={data.intentTrends.C} narrow={narrow} />
          <AttributionTable rows={byIntent.rows} filterKey="intent" />
          <p className="text-xs leading-5 text-ink-tertiary">B/S have too few samples for a trend line.</p>
          <ShiftChart
            shift={byIntent.shift}
            colorOf={(label) => (INTENT_SHIFT_COLOR as Record<string, string>)[label] ?? series.neutral}
            ariaLabel="First vs second half mention share by intent tier"
            caption="First vs second half mention share by intent tier"
            height={140}
          />
        </>
      )}
    </div>
  );
}

/** Half-to-half delta ranking table; every row ends with the "View questions" drill-down carrying the current filter. */
function AttributionTable({ rows, filterKey }: { rows: AttributionRow[]; filterKey: 'platform' | 'intent' }) {
  const { buildHref } = useGlobalFilter();
  const tier = filterKey === 'platform' ? 'Platform' : 'Tier';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          {filterKey === 'platform'
            ? 'Half-to-half visibility attribution by platform, with drill-down links to the question list'
            : 'Half-to-half visibility attribution by intent tier, with drill-down links to the question list'}
        </caption>
        <thead className="border-b border-line text-ink-tertiary">
          <tr>
            <th scope="col" className="py-1.5 pr-3 font-medium">{tier}</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">First half n·rate</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">Second half n·rate</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">Δ</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Verdict</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">Questions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-sunken tabular-nums">
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="py-1.5 pr-3 font-normal text-ink-secondary">{r.label}</th>
              <td className="py-1.5 pr-3 text-right text-ink-secondary">{r.first.n} ({r.first.visibility}%)</td>
              <td className="py-1.5 pr-3 text-right text-ink-secondary">{r.second.n} ({r.second.visibility}%)</td>
              <td className="py-1.5 pr-3 text-right text-ink-secondary">
                <Delta pt={r.deltaPt} suffix="vs first half" />
              </td>
              <td className="py-1.5 pr-3 font-medium text-ink-secondary">{VERDICT_TEXT[r.verdict]}</td>
              <td className="py-1.5 pr-3 text-right">
                <Link
                  href={buildHref('/dashboard/questions', { [filterKey]: r.key })}
                  className="focus-ring inline-block rounded-md text-xs font-medium text-brand hover:text-brand-hover hover:underline"
                >
                  View questions
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 100 % stacked migration bars: one bar per half, segments = each dimension value's mention share; empty → not drawn. */
function ShiftChart({
  shift,
  colorOf,
  ariaLabel,
  caption,
  height,
}: {
  shift: AttributionShift[];
  colorOf: (label: string, index: number) => string;
  ariaLabel: string;
  caption: string;
  height: number;
}) {
  const chart = useMemo(() => shiftChart(shift, colorOf, caption), [shift, colorOf, caption]);
  const total = shift.reduce((n, s) => n + s.firstMentions + s.secondMentions, 0);
  if (total === 0) return null;
  return <EChart ariaLabel={ariaLabel} height={height} option={chart.option} table={chart.table} />;
}

function shiftChart(
  shift: AttributionShift[],
  colorOf: (label: string, index: number) => string,
  caption: string,
): { option: EChartsOption; table: ChartTable } {
  const totalFirst = shift.reduce((n, s) => n + s.firstMentions, 0);
  const totalSecond = shift.reduce((n, s) => n + s.secondMentions, 0);
  const share = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * 100));
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const second = list[0]?.dataIndex === 1;
        const total = second ? totalSecond : totalFirst;
        const lines = list.map((p) => {
          const s = shift[p.seriesIndex ?? 0];
          const count = second ? s.secondMentions : s.firstMentions;
          return `${s.label}: ${count} of ${total} (${p.value}%)`;
        });
        return `${second ? 'Second half' : 'First half'}<br/>${lines.join('<br/>')}`;
      },
    },
    grid: { left: 56, right: 16, top: 8, bottom: 8 },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: ['First half', 'Second half'] },
    series: shift.map((s, i) => ({
      name: s.label,
      type: 'bar',
      stack: 'share',
      itemStyle: { color: colorOf(s.label, i) },
      emphasis: { disabled: true },
      data: [share(s.firstMentions, totalFirst), share(s.secondMentions, totalSecond)],
    })),
  };
  return {
    option,
    table: {
      caption,
      columns: ['Dimension', 'First half share', 'Second half share'],
      rows: shift.map((s) => [s.label, `${share(s.firstMentions, totalFirst)}%`, `${share(s.secondMentions, totalSecond)}%`]),
    },
  };
}

/** 05 §3 A/C 7-day rolling lines: two 2px teal lines, legend + tooltip with window n. */
function IntentTrendChart({ a, c, narrow }: { a: TrendPoint[]; c: TrendPoint[]; narrow: boolean }) {
  const chart = useMemo(() => intentTrendChart(a, c, narrow), [a, c, narrow]);
  return <EChart ariaLabel="7-day rolling visibility for intent A and C" height={260} option={chart.option} table={chart.table} />;
}

function intentTip(tier: 'A' | 'C', p: TrendPoint): string {
  return p.rollingVisibility === null ? `${tier} 7-day: —` : `${tier} 7-day: ${p.rollingMentions}/${p.rollingQuestions} (${p.rollingVisibility}%)`;
}

function intentTrendChart(a: TrendPoint[], c: TrendPoint[], narrow: boolean): { option: EChartsOption; table: ChartTable } {
  const days = a.map((p) => formatDay(p.date));
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const i = list[0]?.dataIndex ?? -1;
        const ap = a[i];
        const cp = c[i];
        if (!ap || !cp) return '';
        return `${formatDay(ap.date)}<br/>${intentTip('A', ap)}<br/>${intentTip('C', cp)}`;
      },
    },
    legend: { data: ['A', 'C'], top: narrow ? 0 : 4 },
    grid: narrow ? { left: 44, right: 16, top: 40, bottom: 28 } : { left: 44, right: 16, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: days, boundaryGap: false, axisLabel: { interval: narrow ? 6 : 'auto' } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: (['A', 'C'] as const).map((tier) => ({
      name: tier,
      type: 'line',
      smooth: false,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2, color: INTENT_LINE_COLOR[tier] },
      itemStyle: { color: INTENT_LINE_COLOR[tier] },
      emphasis: { disabled: true },
      data: (tier === 'A' ? a : c).map((p) => p.rollingVisibility),
    })),
  };
  return {
    option,
    table: {
      caption: '7-day rolling visibility by intent A and C',
      columns: ['Date', 'A', 'A window n', 'C', 'C window n'],
      rows: a.map((p, i) => [
        formatDay(p.date),
        p.rollingVisibility === null ? '—' : `${p.rollingVisibility}%`,
        p.rollingN,
        c[i].rollingVisibility === null ? '—' : `${c[i].rollingVisibility}%`,
        c[i].rollingN,
      ]),
    },
  };
}

/**
 * P1 platform 14-day small multiples (docs/dashboard-design-optimization-v1.md §3): one 2px cyan line per
 * platform (light surface, signal #0891B2 — never 3px, the console keeps the unique thick line), window n
 * badge per cell, tooltip "14-day: 11 rows · 9/11 mentioned (82%)". A single sr-only table carries all five
 * series for screen readers / copying; the canvases stay visually minimal on purpose.
 */
function PlatformSmallMultiples({ trends, narrow }: { trends: PlatformTrends; narrow: boolean }) {
  return (
    <div>
      <p className="mb-2 text-xs text-ink-tertiary">14-day rolling visibility · a window needs n ≥ 8 to draw</p>
      {/* The trend card shares its row with Platforms (half width at lg), so 3-up here = readable ~150px cells. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const pts = trends[p] ?? [];
          const n = latestWindowN(pts);
          return (
            <div key={p} className="rounded-lg border border-line p-2">
              <div className="flex items-baseline justify-between px-0.5">
                <span className="text-xs font-medium text-ink-secondary">{p}</span>
                <span className="text-[11px] tabular-nums text-ink-tertiary">{n === null ? 'n—' : `n=${n}`}</span>
              </div>
              <EChart
                ariaLabel={`14-day rolling visibility for ${p}`}
                height={88}
                option={platformTrendOption(p, pts, narrow)}
                tableToggle={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Screen-reader / copy surface behind the five platform sparklines (canvas is opaque). The wrapper, not the
 *  table, carries sr-only: a table ignores the 1px clip width and would force horizontal scroll on 375px. */
function PlatformTrendsTable({ trends }: { trends: PlatformTrends }) {
  const days = trends[PLATFORMS[0]]?.map((p) => p.date) ?? [];
  return (
    <div className="sr-only">
      <table>
        <caption>14-day rolling visibility by platform</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {PLATFORMS.map((p) => (
              <th key={p} scope="col">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {days.map((d, i) => (
            <tr key={d}>
              <th scope="row">{formatDay(d)}</th>
              {PLATFORMS.map((p) => {
                const v = trends[p][i]?.rollingVisibility;
                return <td key={p}>{v === null || v === undefined ? '—' : `${v}%`}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
