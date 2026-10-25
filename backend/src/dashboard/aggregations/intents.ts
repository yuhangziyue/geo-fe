import { pct } from '../metrics';
import { INTENT_DISPLAY_ORDER, INTENT_LABELS, type IntentRow, type Question } from '../schema';

/** The four intent tiers, always all four, in display order C → B → A → S (05 §2.6). */
export function intentRows(rows: Question[]): IntentRow[] {
  return INTENT_DISPLAY_ORDER.map((tier) => {
    const qs = rows.filter((q) => q.intent_type === tier);
    const mentions = qs.filter((q) => q.brand_mentioned).length;
    const recommendations = qs.filter((q) => q.brand_recommended).length;
    return {
      tier,
      label: INTENT_LABELS[tier].name,
      questions: qs.length,
      mentions,
      recommendations,
      visibility: pct(mentions, qs.length),
      recommendationRateOfAsked: pct(recommendations, qs.length),
      isEmpty: qs.length === 0,
    };
  });
}
