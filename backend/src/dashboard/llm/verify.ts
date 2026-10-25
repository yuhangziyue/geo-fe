import type { ExtractedNumber, LlmFacts, LlmSummaryResult } from '../schema';

/**
 * Number check for summaries — T0 stub, B2 implements (algorithm: B2 brief §5).
 * extract: every number in the text, in order, with its unit ('pct' for "71%", 'pt' for "12 pt", 'count' otherwise)
 *          and its [start, end) offsets in the text.
 * verify: match against the flattened facts with the same unit (evidence data carry their own unit); tolerance ±1
 *         for pct and pt, exact for counts. `verification` comes from schema.verificationOf — do not re-derive the band.
 */
export function extractNumbers(text: string): ExtractedNumber[] {
  void text;
  throw new Error('not implemented in T0');
}

export function verifyAgainstFacts(
  nums: ExtractedNumber[],
  facts: LlmFacts,
): Pick<LlmSummaryResult, 'numbers' | 'verification'> {
  void nums;
  void facts;
  throw new Error('not implemented in T0');
}
