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
 * Daily dots are a scatter series: one dot for every day that has questions, never joined by a line.
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

/** 05 §2.5 daily tooltip: "Aug 4 · 4/4 mentioned (n=4)". */
function dailyTip(p: TrendPoint): string {
  const day = formatDay(p.date);
  return p.dailyQuestions === 0 ? `${day} · No questions this day` : `${day} · ${p.dailyMentions}/${p.dailyQuestions} mentioned (n=${p.dailyQuestions})`;
}

/** 05 §2.5 rolling tooltip: "7-day: 22/28 (79%)"; while the window is not full there is no rolling value. */
function rollingTip(p: TrendPoint): string {
  return p.rollingVisibility === null ? '7-day: —' : `7-day: ${p.rollingMentions}/${p.rollingQuestions} (${p.rollingVisibility}%)`;
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
        return `${dailyTip(p)}<br/>${rollingTip(p)}`;
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
        // A scatter draws every data point (no symbol sampling, the intent of the old line's showAllSymbol) and
        // never joins them; a day without questions is '-' (missing), so it gets no dot instead of a 0% dot.
        name: 'Daily',
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: series.dailyDot },
        emphasis: { disabled: true },
        data: points.map((p) => p.dailyVisibility ?? '-'),
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
