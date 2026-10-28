import { describe, expect, it } from 'vitest';
import type { TrendPoint } from '../types';
import {
  CONSOLE_LINE_WIDTH,
  PLAN_B_SIGNAL,
  SMALL_MULTIPLE_LINE_WIDTH,
  asOfStamp,
  consoleTrendOption,
  latestWindowN,
  platformTip,
  platformTrendOption,
} from './trendCharts';

const day = (i: number) => `2026-08-${String(i + 1).padStart(2, '0')}`;

const point = (i: number, overrides: Partial<TrendPoint> = {}): TrendPoint => ({
  date: day(i),
  dailyVisibility: 75,
  dailyN: 4,
  dailyMentions: 3,
  dailyQuestions: 4,
  rollingVisibility: i >= 6 ? 80 : null,
  rollingN: i >= 6 ? 28 : 0,
  rollingMentions: i >= 6 ? 22 : 0,
  rollingQuestions: i >= 6 ? 28 : 0,
  ...overrides,
});

const points = Array.from({ length: 30 }, (_, i) => point(i));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seriesOf = (option: unknown): any[] => (option as { series: any[] }).series;

describe('consoleTrendOption — the dark signal console (docs/dashboard-design-optimization-v1.md §2)', () => {
  it('draws the Overall rolling line as 3px #22D3EE — cyan time signal, the site-wide unique thick line', () => {
    const rolling = seriesOf(consoleTrendOption(points, false)).find((s) => s.name === '7-day rolling');
    expect(rolling.lineStyle.width).toBe(CONSOLE_LINE_WIDTH);
    expect(rolling.lineStyle.width).toBe(3);
    expect(rolling.lineStyle.color).toBe('#22D3EE');
  });

  it('has no other 3px series in the console', () => {
    for (const s of seriesOf(consoleTrendOption(points, false))) {
      if (s.name !== '7-day rolling') expect(s.lineStyle?.width).not.toBe(3);
    }
  });

  it('keeps daily values as unconnected samples (scatter, nulls break the signal line)', () => {
    const option = consoleTrendOption(points, false);
    const rolling = seriesOf(option).find((s) => s.name === '7-day rolling');
    const daily = seriesOf(option).find((s) => s.name === 'Daily');
    expect(rolling.connectNulls).toBe(false);
    expect(daily.type).toBe('scatter');
  });
});

describe('platformTrendOption — the 14-day small multiples (docs §3)', () => {
  const option = platformTrendOption('DeepSeek', points, false);

  it('draws a 2px #0891B2 line on the light surface — never a second 3px line', () => {
    const line = seriesOf(option)[0];
    expect(line.lineStyle.width).toBe(SMALL_MULTIPLE_LINE_WIDTH);
    expect(line.lineStyle.width).toBe(2);
    expect(line.lineStyle.color).toBe('#0891B2');
  });

  it('never connects across null windows and draws no symbols', () => {
    const line = seriesOf(option)[0];
    expect(line.connectNulls).toBe(false);
    expect(line.showSymbol).toBe(false);
  });

  it('pins the scale to 0–100 % on a 14-day window', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y = (option as any).yAxis;
    expect(y.min).toBe(0);
    expect(y.max).toBe(100);
  });

  it('labels the tooltip "14-day: <n> rows" with the window numerator, and "14-day: —" when gated', () => {
    expect(platformTip(point(29, { rollingQuestions: 11, rollingMentions: 9, rollingVisibility: 82 }))).toBe(
      '14-day: 11 rows · 9/11 mentioned (82%)',
    );
    expect(platformTip(point(5, { rollingVisibility: null, rollingQuestions: 7, rollingMentions: 6 }))).toBe('14-day: —');
  });
});

describe('latestWindowN — the per-cell n badge (window n, never full-period n)', () => {
  it('is the last full window’s question count', () => {
    expect(latestWindowN(points)).toBe(28);
    expect(
      latestWindowN([
        point(0, { rollingVisibility: null, rollingQuestions: 0 }),
        point(1, { rollingVisibility: 75, rollingQuestions: 11 }),
      ]),
    ).toBe(11);
  });

  it('is null when no window was ever full', () => {
    expect(latestWindowN([point(0, { rollingVisibility: null, rollingQuestions: 0 })])).toBeNull();
  });
});

describe('asOfStamp — the static data-cutoff marker, not a live feed', () => {
  it('formats the last point date', () => {
    expect(asOfStamp('2026-08-30')).toBe('as of Aug 30');
  });
});

describe('Plan B (docs §2: indigo brighten, kept not wired)', () => {
  it('keeps the fallback hex ready for a walkthrough-driven switch', () => {
    expect(PLAN_B_SIGNAL).toBe('#818CF8');
  });
});
