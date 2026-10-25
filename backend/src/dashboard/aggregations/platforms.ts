import { pct } from '../metrics';
import { PLATFORMS, type PlatformRow, type Question } from '../schema';

/** Marks the rows with the lowest value, only when there is something to compare (≥ 2 rows that differ). */
export function worstFlags(values: number[]): boolean[] {
  if (values.length < 2) return values.map(() => false);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((v) => min < max && v === min);
}

/** Platform card, ratio version (05 §2.4): one row per platform that has rows, in PLATFORMS order. */
export function platformRows(rows: Question[]): PlatformRow[] {
  const out = PLATFORMS.flatMap((name) => {
    const qs = rows.filter((q) => q.platform === name);
    if (qs.length === 0) return [];
    const mentions = qs.filter((q) => q.brand_mentioned).length;
    const recommendations = qs.filter((q) => q.brand_recommended).length;
    const cited = qs.filter((q) => q.citations.length > 0).length;
    return [{
      name,
      n: qs.length,
      mentions,
      recommendations,
      cited,
      visibility: pct(mentions, qs.length),
      recommendationRateOfAsked: pct(recommendations, qs.length),
      sourceBackedRateOfMentioned: pct(cited, mentions),
      isWorst: false,
    }];
  });
  const worst = worstFlags(out.map((r) => r.visibility));
  return out.map((r, i) => ({ ...r, isWorst: worst[i] }));
}
