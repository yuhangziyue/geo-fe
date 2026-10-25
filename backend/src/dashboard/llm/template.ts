import type { EvidenceDatum, LlmFacts, LlmSummaryResult } from '../schema';
import { extractNumbers, verifyAgainstFacts } from './verify';

/** First line of the template when it stands in for a failed AI call (brief Step 3). */
export const FALLBACK_NOTE = '(AI summary unavailable — showing rule-based findings.)';

function evidenceText(e: EvidenceDatum): string {
  const value = e.unit === 'pct' ? `${e.value}%` : e.unit === 'pt' ? `${e.value} pt` : e.of !== undefined ? `${e.value}/${e.of}` : `${e.value}`;
  return `${e.label}: ${value}`;
}

function deltaSentence(pt: number | null): string {
  if (pt === null) return 'There are too few samples to compare the two halves of the period.';
  if (pt < 0) return `Visibility fell ${-pt} pt from the first half of the period to the second.`;
  if (pt > 0) return `Visibility rose ${pt} pt from the first half of the period to the second.`;
  return 'Visibility held steady between the two halves of the period.';
}

/**
 * Deterministic summary built from `facts`.
 * Pure: never throws, no network; every number is copied from facts, so the result is 100% verified — the
 * verification is still computed by verify.ts, not asserted, so a template bug would show up as a red number.
 * Returns mode 'rules', model null, and `reason` as passed (why the AI path was not used). A failed AI call
 * (timeout / upstream_error) opens with FALLBACK_NOTE; no key is the normal Rules mode and gets no note.
 * No dates or day counts in the text: they are not numeric facts and would come back unverified.
 */
export function buildTemplateSummary(facts: LlmFacts, reason?: LlmSummaryResult['reason']): LlmSummaryResult {
  const f = facts.funnel;
  const sentences = [
    `${facts.brand} was mentioned in ${f.mentions} of ${f.questions} tracked questions (${f.mentionRateOfAsked}%) and recommended in ${f.recommendations} (${f.recommendRateOfAsked}%).`,
    deltaSentence(facts.delta.mentionRateOfAskedPt),
    facts.sources.totalCitations > 0
      ? `Owned sources account for ${facts.sources.ownedShareOfCitations}% of ${facts.sources.totalCitations} citations.`
      : 'No citations were recorded in this selection.',
  ];
  if (facts.topFindings.length > 0) {
    sentences.push(
      `Top findings: ${facts.topFindings.map((t) => (t.evidence[0] ? `${t.finding} (${evidenceText(t.evidence[0])})` : t.finding)).join('; ')}.`,
    );
  }
  const failed = reason === 'timeout' || reason === 'upstream_error';
  const text = (failed ? `${FALLBACK_NOTE}\n` : '') + sentences.join(' ');
  return { mode: 'rules', text, ...verifyAgainstFacts(extractNumbers(text), facts), model: null, reason: reason ?? null };
}
