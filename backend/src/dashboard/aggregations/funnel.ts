import { isOwnedUrl } from '../insight';
import { pct } from '../metrics';
import type { FunnelKpi, PeriodHalves, Question } from '../schema';
import { halfDelta, MIN_HALF_CITATIONS, MIN_HALF_MENTIONS } from './period';

const count = (rows: Question[], p: (q: Question) => boolean) => rows.filter(p).length;
const mentions = (rows: Question[]) => count(rows, (q) => q.brand_mentioned);
const recommendations = (rows: Question[]) => count(rows, (q) => q.brand_recommended);
const cited = (rows: Question[]) => count(rows, (q) => q.citations.length > 0);
const citationsOf = (rows: Question[]) => rows.flatMap((q) => q.citations);
const ownedOf = (rows: Question[]) => citationsOf(rows).filter((c) => isOwnedUrl(c.url)).length;

/** Each rate as a function of rows, so the same definition gives the value and its half-period delta. */
const rate = {
  mentionsOfAsked: (r: Question[]) => pct(mentions(r), r.length),
  recommendationsOfAsked: (r: Question[]) => pct(recommendations(r), r.length),
  citedOfMentioned: (r: Question[]) => pct(cited(r), mentions(r)),
  ownedOfCitations: (r: Question[]) => pct(ownedOf(r), citationsOf(r).length),
};

/** Asked → Mentioned → Recommended + two non-nested side metrics (05 §2.2, F6). Deltas: last − first half, pt. */
export function buildFunnel(rows: Question[], halves: PeriodHalves): FunnelKpi {
  const m = mentions(rows);
  const r = recommendations(rows);
  const mentionRate = rate.mentionsOfAsked(rows);
  return {
    questions: { value: rows.length },
    mentions: { value: m, rateOfAsked: mentionRate, rateOfPrevious: mentionRate, deltaPt: halfDelta(rows, halves, rate.mentionsOfAsked) },
    recommendations: {
      value: r,
      rateOfAsked: rate.recommendationsOfAsked(rows),
      rateOfPrevious: pct(r, m),
      deltaPt: halfDelta(rows, halves, rate.recommendationsOfAsked),
    },
    sourceBacked: { cited: cited(rows), rateOfMentioned: rate.citedOfMentioned(rows), deltaPt: halfDelta(rows, halves, rate.citedOfMentioned, { size: mentions, min: MIN_HALF_MENTIONS }) },
    ownedSource: {
      owned: ownedOf(rows),
      totalCitations: citationsOf(rows).length,
      shareOfCitations: rate.ownedOfCitations(rows),
      deltaPt: halfDelta(rows, halves, rate.ownedOfCitations, { size: (r) => citationsOf(r).length, min: MIN_HALF_CITATIONS }),
    },
  };
}
