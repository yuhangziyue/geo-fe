import type { ExtractedNumber, LlmFacts, LlmSummaryResult } from '../schema';

/**
 * Number check for summaries — T0 stub, B2 implements (algorithm: B2 brief §5).
 * extract: every number in the text with its unit ('%', 'pt' or '' for a plain count).
 * verify: match against the flattened facts with the same unit; tolerance ±1 for % and pt, exact for counts.
 * band: ratio 1 → 'all'; 0 < ratio < 1 → 'partial'; 0 → 'none'; no numbers (0/0) → 'na'.
 */
export function extractNumbers(text: string): ExtractedNumber[] {
  void text;
  throw new Error('not implemented in T0');
}

export function verifyAgainstFacts(
  nums: ExtractedNumber[],
  facts: LlmFacts,
): Pick<LlmSummaryResult, 'numbers' | 'verifiedRatio' | 'verifiedBand'> {
  void nums;
  void facts;
  throw new Error('not implemented in T0');
}
