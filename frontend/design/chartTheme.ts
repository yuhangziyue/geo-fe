import { color } from './tokens';

// ECharts series colours (spec 06 §3.7).
export const series = {
  visibility: '#6366F1', // mention rate
  recommendation: '#312E81', // recommendation rate (same family as cov-rec)
  sourceBacked: '#0D9488', // side metric, not in the funnel
  neutral: '#64748B', // source_type distribution, non-owned domains
  lowest: '#D97706', // weakest-bar marker
  dailyDot: '#A5B4FC', // trend daily scatter (exception E2)
} as const;

export const palette: readonly string[] = [
  series.visibility,
  series.recommendation,
  series.sourceBacked,
  series.neutral,
  series.lowest,
];

const axis = {
  axisLine: { lineStyle: { color: color.line.DEFAULT } },
  axisTick: { lineStyle: { color: color.line.DEFAULT } },
  axisLabel: { color: color.ink.tertiary, fontSize: 12 },
  splitLine: { lineStyle: { color: color.surface.sunken } },
};

// Spec 06 §8.1.4. Registered once as 'geo' in components/dashboard/echarts.ts; charts opt in via init(el, 'geo').
export const geoTheme = {
  color: [...palette],
  // Entrance animation stays on once; reduced-motion users get none (06 §4).
  animation: !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  textStyle: { fontFamily: 'inherit', color: color.ink.tertiary, fontSize: 12 },
  categoryAxis: axis,
  valueAxis: axis,
  timeAxis: axis,
  legend: { textStyle: { color: color.ink.secondary, fontSize: 12 } },
  tooltip: {
    backgroundColor: color.surface.card,
    borderColor: color.line.DEFAULT,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: color.ink.DEFAULT, fontSize: 12 },
    // Tailwind shadow-md equivalent; the rounded-xl (12px) corner has no ECharts option.
    extraCssText: 'border-radius:12px;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1);',
  },
  bar: { barGap: '8%', itemStyle: { borderColor: color.surface.card, borderWidth: 1 } },
};
