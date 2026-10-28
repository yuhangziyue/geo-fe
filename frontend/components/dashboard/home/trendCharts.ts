import type { EChartsOption } from 'echarts';
import { color } from '../../../design/tokens';
import type { ChartTable } from '../EChart';
import type { Platform, TrendPoint } from '../types';
import { formatDay } from './shared';

/**
 * P1 signal console (docs/dashboard-design-optimization-v1.md §2–§3). Pure ECharts option builders — no React —
 * so the red lines (3px uniqueness, cyan hexes, window tooltips) are unit-testable.
 *
 * Semantic contract: indigo stays status/recommend (untouched); CYAN is time signal only; the cyan console line
 * and the teal intent lines never share an axis (Overall tab vs Attribution tab in Trend.tsx).
 */

/** The site-wide unique thick line: the Overall 7-day rolling signal on the dark console. */
export const CONSOLE_LINE_WIDTH = 3;
/** Every other trend line — intent A/C and the platform small multiples — is 2px. */
export const SMALL_MULTIPLE_LINE_WIDTH = 2;

/** Cyan on #0F172A: 9.88:1. The one signal colour for the dark console. */
const SIGNAL_ON_DARK = color.signal['on-dark']; // #22D3EE
/** Cyan graphics on a light surface: 3.68:1 (platform small multiples). */
const SIGNAL_LIGHT = color.signal.DEFAULT; // #0891B2
/** Daily dots on the console stay faint and subordinate to the 3px signal. */
const DAILY_DOT_ON_CONSOLE = color.signal.ink; // #0E7490

/**
 * Plan B (docs §2 / round-3-qianqian §2): if the walkthrough finds cyan/teal muddy even with view separation,
 * switch the console line to this brightened indigo (5.98:1 on #0F172A, 61° away from teal). Kept, never wired:
 * the trigger is a human walkthrough verdict, not code.
 */
export const PLAN_B_SIGNAL = '#818CF8';

/** "as of Aug 30" — the static cutoff stamp; derived from the last trend date, never a polling timestamp. */
export const asOfStamp = (date: string): string => `as of ${formatDay(date)}`;

/** The n badge of one small-multiple cell: the LAST full window's question count (window n, never full-period n). */
export function latestWindowN(points: TrendPoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].rollingVisibility !== null) return points[i].rollingQuestions;
  }
  return null;
}

/** 05 §2.5 daily tooltip: "Aug 4 · 4/4 mentioned (n=4)". */
export function dailyTip(p: TrendPoint): string {
  const day = formatDay(p.date);
  return p.dailyQuestions === 0 ? `${day} · No questions this day` : `${day} · ${p.dailyMentions}/${p.dailyQuestions} mentioned (n=${p.dailyQuestions})`;
}

/** 05 §2.5 rolling tooltip: "7-day: 22/28 (79%)"; while the window is not full there is no rolling value. */
export function rollingTip(p: TrendPoint): string {
  return p.rollingVisibility === null ? '7-day: —' : `7-day: ${p.rollingMentions}/${p.rollingQuestions} (${p.rollingVisibility}%)`;
}

/** P1 platform window tooltip: "14-day: 11 rows · 9/11 mentioned (82%)"; a gated window shows "14-day: —". */
export function platformTip(p: TrendPoint): string {
  return p.rollingVisibility === null
    ? '14-day: —'
    : `14-day: ${p.rollingQuestions} rows · ${p.rollingMentions}/${p.rollingQuestions} mentioned (${p.rollingVisibility}%)`;
}

/**
 * The Overall monitoring console chart: cyan 3px 7-day rolling line (the unique thick line) plus faint daily
 * samples. Axis / legend / tooltip colours come from the geoConsole theme at chart init, not from this option.
 */
export function consoleTrendOption(points: TrendPoint[], narrow: boolean): EChartsOption {
  const days = points.map((p) => formatDay(p.date));
  return {
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
        lineStyle: { width: CONSOLE_LINE_WIDTH, color: SIGNAL_ON_DARK },
        itemStyle: { color: SIGNAL_ON_DARK },
        emphasis: { disabled: true },
        data: points.map((p) => p.rollingVisibility),
      },
      {
        // Scatter = every daily sample drawn, never joined (showAllSymbol without a line); an empty day is '-',
        // so it gets no dot instead of a 0% dot. Dim cyan keeps the 3px signal dominant.
        name: 'Daily',
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: DAILY_DOT_ON_CONSOLE, opacity: 0.7 },
        emphasis: { disabled: true },
        data: points.map((p) => p.dailyVisibility ?? '-'),
      },
    ],
  };
}

/** Accessible table behind the console chart (Chart/Table switch on EChart). */
export function consoleTrendTable(points: TrendPoint[]): ChartTable {
  return {
    caption: 'Daily and 7-day rolling visibility',
    columns: ['Date', 'Daily', 'Questions', '7-day rolling', 'Window questions'],
    rows: points.map((p) => [
      formatDay(p.date),
      p.dailyVisibility === null ? '—' : `${p.dailyVisibility}%`,
      p.dailyN,
      p.rollingVisibility === null ? '—' : `${p.rollingVisibility}%`,
      p.rollingN,
    ]),
  };
}

/**
 * One platform 14-day small multiple on the LIGHT attribution surface: a single 2px cyan line (never 3px),
 * no symbols, null windows break the line. Minimal axes — the point is cross-platform scanning, not precision.
 */
export function platformTrendOption(platform: Platform, points: TrendPoint[], narrow: boolean): EChartsOption {
  const days = points.map((p) => formatDay(p.date));
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const p = points[list[0]?.dataIndex ?? -1];
        if (!p) return '';
        return `${platform} · ${formatDay(p.date)}<br/>${platformTip(p)}`;
      },
    },
    grid: { left: narrow ? 26 : 30, right: 18, top: 6, bottom: 18 },
    xAxis: {
      type: 'category',
      data: days,
      boundaryGap: false,
      axisLabel: { interval: Math.max(0, points.length - 1), fontSize: 10, hideOverlap: true },
    },
    yAxis: { type: 'value', min: 0, max: 100, splitNumber: 2, axisLabel: { formatter: '{value}%', fontSize: 10 } },
    series: [
      {
        name: `${platform} 14-day rolling`,
        type: 'line',
        smooth: false,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: SMALL_MULTIPLE_LINE_WIDTH, color: SIGNAL_LIGHT },
        itemStyle: { color: SIGNAL_LIGHT },
        emphasis: { disabled: true },
        data: points.map((p) => p.rollingVisibility),
      },
    ],
  };
}
