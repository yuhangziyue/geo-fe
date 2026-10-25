'use client';

import type { EChartsOption } from 'echarts';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { series } from '../../../design/chartTheme';
import { color } from '../../../design/tokens';
import { AsyncState, Card } from '../AsyncState';
import { EChart, type ChartTable } from '../EChart';
import type { PlatformRow } from '../types';
import { useGlobalFilter } from '../useGlobalFilter';
import { asyncProps, ClearFilters, useIsNarrow, type SummaryApi } from './shared';

/**
 * ④-left Platform comparison, ratio version (05 §2.4, 06 §5.3): Visibility / Recommendation rate / Source-backed,
 * sorted by Visibility desc; the weakest platform (backend `isWorst`) is labelled "Lowest". <640 → horizontal bars.
 */
export function Platforms({ api }: { api: SummaryApi }) {
  const router = useRouter();
  const { buildHref } = useGlobalFilter();
  const narrow = useIsNarrow();
  const rows = api.data?.platforms;
  const chart = useMemo(() => (rows ? platformChart(rows, narrow) : null), [rows, narrow]);

  return (
    <Card title="By platform" subtitle="Share of questions per platform · click a platform to see its questions">
      <AsyncState
        {...asyncProps(api)}
        isEmpty={!!rows && rows.every((p) => p.n === 0)}
        skeletonHeight={300}
        empty={
          <>
            <p>No questions match these filters.</p>
            <ClearFilters />
          </>
        }
      >
        {() => (
          <EChart
            ariaLabel="Visibility, recommendation rate and source-backed rate by platform"
            height={narrow ? 340 : 300}
            option={chart!.option}
            table={chart!.table}
            onClick={({ name }) => router.push(buildHref('/dashboard/questions', { platform: name }))}
          />
        )}
      </AsyncState>
    </Card>
  );
}

function platformChart(input: PlatformRow[], horizontal: boolean): { option: EChartsOption; table: ChartTable } {
  // Display order only (05 §2.4: by Visibility desc); the rates themselves come from the backend untouched.
  const rows = input.filter((p) => p.n > 0).sort((a, b) => b.visibility - a.visibility);
  const names = rows.map((p) => p.name);
  const byName = new Map(rows.map((p) => [p.name as string, p]));

  const category = {
    type: 'category' as const,
    data: names,
    inverse: horizontal,
    axisLabel: {
      interval: 0,
      lineHeight: 16,
      formatter: (name: string) => {
        const p = byName.get(name);
        if (!p) return name;
        return p.isWorst ? `{name|${name}}\n{low|n=${p.n} · Lowest}` : `{name|${name}}\n{n|n=${p.n}}`;
      },
      rich: {
        name: { color: color.ink.secondary, fontSize: 12 },
        n: { color: color.ink.tertiary, fontSize: 12 },
        low: { color: color.warning.DEFAULT, fontSize: 12 },
      },
    },
  };
  const value = { type: 'value' as const, min: 0, max: 100, axisLabel: { formatter: '{value}%' } };

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const p = byName.get(String(list[0]?.name));
        if (!p) return '';
        return [
          `<b>${p.name}</b> · n=${p.n}`,
          `Visibility ${p.visibility}% (${p.mentions}/${p.n})`,
          `Recommendation rate ${p.recommendationRateOfAsked}% (${p.recommendations}/${p.n})`,
          `Source-backed ${p.sourceBackedRateOfMentioned}% (${p.cited}/${p.mentions})`,
        ].join('<br/>');
      },
    },
    legend: horizontal ? { top: 0 } : { bottom: 0 },
    grid: horizontal ? { left: 96, right: 40, top: 36, bottom: 24 } : { left: 44, right: 16, top: 24, bottom: 72 },
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: [
      {
        name: 'Visibility',
        type: 'bar',
        data: rows.map((p) => p.visibility),
        itemStyle: { color: series.visibility },
        label: { show: true, position: horizontal ? 'right' : 'top', formatter: '{c}%', color: color.ink.secondary, fontSize: 12 },
      },
      { name: 'Recommendation rate', type: 'bar', data: rows.map((p) => p.recommendationRateOfAsked), itemStyle: { color: series.recommendation } },
      { name: 'Source-backed', type: 'bar', data: rows.map((p) => p.sourceBackedRateOfMentioned), itemStyle: { color: series.sourceBacked } },
    ],
  };

  return {
    option,
    table: {
      caption: 'Rates by platform',
      columns: ['Platform', 'Questions', 'Visibility', 'Recommendation rate', 'Source-backed'],
      rows: rows.map((p) => [
        p.isWorst ? `${p.name} (lowest)` : p.name,
        p.n,
        `${p.visibility}% (${p.mentions}/${p.n})`,
        `${p.recommendationRateOfAsked}% (${p.recommendations}/${p.n})`,
        `${p.sourceBackedRateOfMentioned}% (${p.cited}/${p.mentions})`,
      ]),
    },
  };
}
