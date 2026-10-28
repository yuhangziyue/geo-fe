import { color } from './tokens';

// ECharts series colours (spec 06 §3.7).
export const series = {
  visibility: '#6366F1', // mention rate
  recommendation: '#312E81', // recommendation rate (same family as cov-rec)
  sourceBacked: '#0D9488', // side metric, not in the funnel
  neutral: '#64748B', // source_type distribution, non-owned domains
  lowest: '#D97706', // weakest-bar marker
  dailyDot: '#A5B4FC', // trend daily scatter (exception E2)
  // P1 cyan time-signal family (docs/dashboard-design-optimization-v1.md §2) — values come from tokens.ts.
  signal: color.signal.DEFAULT, // #0891B2 — cyan line on LIGHT surfaces (platform small multiples)
  signalInk: color.signal.ink, // #0E7490 — faint daily dots on the dark console
  signalOnDark: color.signal['on-dark'], // #22D3EE — the 3px console signal line
};

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

// Dark monitoring-console variant (P1 signal console): hairline grid #1E293B on #0F172A, axes / legend in
// ink-on-console, tooltip elevated to line-console. Registered as 'geoConsole'; only the Overall trend chart
// opts in — cyan and teal never share an axis.
const consoleAxis = {
  axisLine: { lineStyle: { color: color.line.console } },
  axisTick: { lineStyle: { color: color.line.console } },
  axisLabel: { color: color.ink['on-console'], fontSize: 12 },
  splitLine: { lineStyle: { color: color.line.console } },
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

// Dark counterpart of geoTheme for the trend signal console (P1).
export const geoConsoleTheme = {
  color: [series.signalOnDark, series.signalInk, ...palette],
  animation: geoTheme.animation,
  textStyle: { fontFamily: 'inherit', color: color.ink['on-console'], fontSize: 12 },
  categoryAxis: consoleAxis,
  valueAxis: consoleAxis,
  timeAxis: consoleAxis,
  legend: { textStyle: { color: color.ink['on-console'], fontSize: 12 } },
  tooltip: {
    backgroundColor: color.line.console,
    borderColor: color.ink.DEFAULT,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: color.ink.inverse, fontSize: 12 },
    extraCssText: 'border-radius:12px;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.4),0 2px 4px -2px rgb(0 0 0 / 0.3);',
  },
};
