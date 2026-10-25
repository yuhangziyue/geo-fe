'use client';

import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import { series } from '../../../design/chartTheme';
import { AsyncState, Card } from '../AsyncState';
import { EChart, type ChartTable } from '../EChart';
import type { TrendPoint } from '../types';
import { asyncProps, ClearFilters, formatDay, useIsNarrow, type SummaryApi } from './shared';

/**
 * ④-right 7-day rolling visibility (05 §2.5, 06 §5.4): the rolling line is the signal (no smoothing, no markers,
 * absent while the window is not full); daily values are faint dots because a day is only a handful of questions.
 * Daily dots are a line series with an invisible line — the shared echarts.ts registers Bar + Line only.
 */
export function Trend({ api }: { api: SummaryApi }) {
  const narrow = useIsNarrow();
  const points = api.data?.trend;
  const chart = useMemo(() => (points ? trendChart(points, narrow) : null), [points, narrow]);
  const hasRolling = !!points?.some((p) => p.rollingVisibility !== null);
  const sizes = [...new Set((points ?? []).filter((p) => p.dailyN > 0).map((p) => p.dailyN))];
  const sampleNote =
    sizes.length === 1 ? `daily samples are only ${sizes[0]} questions` : `daily samples are only ${Math.min(...sizes)}–${Math.max(...sizes)} questions`;

  return (
    <Card
      title="Visibility trend"
      subtitle={
        points && sizes.length > 0
          ? `7-day rolling · ${sampleNote}${hasRolling ? '' : ' · Not enough days for a rolling line'}`
          : '7-day rolling'
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
        {() => <EChart ariaLabel="7-day rolling visibility with daily values" height={300} option={chart!.option} table={chart!.table} />}
      </AsyncState>
    </Card>
  );
}

function trendChart(points: TrendPoint[], narrow: boolean): { option: EChartsOption; table: ChartTable } {
  const days = points.map((p) => formatDay(p.date));
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const p = points[list[0]?.dataIndex ?? -1];
        if (!p) return '';
        const rolling = p.rollingVisibility === null ? '7-day —' : `7-day ${p.rollingVisibility}% (n=${p.rollingN})`;
        const daily = p.dailyVisibility === null ? 'No questions this day' : `Daily ${p.dailyVisibility}% (n=${p.dailyN})`;
        return `<b>${formatDay(p.date)}</b> · ${rolling}<br/>${daily}`;
      },
    },
    legend: narrow ? { top: 0 } : { bottom: 0 },
    grid: narrow ? { left: 44, right: 16, top: 36, bottom: 28 } : { left: 44, right: 16, top: 16, bottom: 48 },
    xAxis: { type: 'category', data: days, boundaryGap: false, axisLabel: { interval: narrow ? 6 : 'auto' } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: '7-day rolling',
        type: 'line',
        smooth: false,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, color: series.visibility },
        itemStyle: { color: series.visibility },
        emphasis: { disabled: true },
        data: points.map((p) => p.rollingVisibility),
      },
      {
        name: 'Daily',
        type: 'line',
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: true,
        showAllSymbol: true,
        connectNulls: false,
        lineStyle: { width: 0, opacity: 0 },
        itemStyle: { color: series.dailyDot },
        emphasis: { disabled: true },
        data: points.map((p) => p.dailyVisibility),
      },
    ],
  };
  return {
    option,
    table: {
      caption: 'Daily and 7-day rolling visibility',
      columns: ['Date', 'Daily', 'Questions', '7-day rolling', 'Window questions'],
      rows: points.map((p) => [
        formatDay(p.date),
        p.dailyVisibility === null ? '—' : `${p.dailyVisibility}%`,
        p.dailyN,
        p.rollingVisibility === null ? '—' : `${p.rollingVisibility}%`,
        p.rollingN,
      ]),
    },
  };
}
