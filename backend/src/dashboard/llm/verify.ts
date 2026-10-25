import { verificationOf, type ExtractedNumber, type LlmFacts, type LlmSummaryResult, type NumberUnit, type VerifiedNumber } from '../schema';

/**
 * Number check for summaries (B2 brief §5).
 * extract: every number in the text, in order, with its unit ('pct' for "71%", 'pt' for "12 pt", 'count' otherwise)
 *          and its [start, end) offsets in the text.
 * verify: match against the flattened facts with the same unit (evidence data carry their own unit); tolerance ±1
 *         for pct and pt, exact for counts. `verification` comes from schema.verificationOf — the band is not re-derived.
 *
 * pt is compared by size: "dropped 12 pt" and "-12 pt" both state the −12 pt fact, and a summary writes the
 * direction in words far more often than as a sign. The cost: "rose 12 pt" would also pass. Accepted — the facts
 * hold one or two pt values and the risk of red-flagging a correct sentence is the worse failure in a demo.
 */

/**
 * One number in a summary (T-FIX widened B2's regex; verify.test.ts has a case for each rule):
 *   - not glued to a letter, digit, "." or "%" BEFORE it: version / model names ("v1.2", "Nova X8", "H2O") are skipped,
 *     and a "-" right after a "%" is a range separator ("77%-65%" → 77%, 65%), not the sign of the next number;
 *   - integer part may carry thousands separators ("1,200" → 1200; "7, 71" and "7,71" stay two numbers);
 *   - unit: "%" (pct); "pt" / "pts" / "pp", spaced or glued (pt; not "points"); otherwise count;
 *   - letters glued AFTER it ("3x", "12k") still make it a number the summary states → extracted as a count, so a
 *     made-up "3x" is checked (and goes red) instead of silently skipped. Ordinals ("1st", "2nd") are ranks, skipped.
 * Groups: 1 = number, 2 = "%", 3 = pt unit, 4 = glued letters.
 */
const NUMBER_RE = /(?<![A-Za-z_\d.%])(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?:\s?(%)|\s*(pp|pts?)(?![A-Za-z_])|([A-Za-z]+))?(?![A-Za-z_\d])/g;
const ORDINAL = /^(st|nd|rd|th)$/i;

export function extractNumbers(text: string): ExtractedNumber[] {
  const out: ExtractedNumber[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    if (m[4] && ORDINAL.test(m[4])) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const unit: NumberUnit = m[2] ? 'pct' : m[3] ? 'pt' : 'count';
    out.push({ raw: text.slice(start, end), value: Number(m[1].replace(/,/g, '')), unit, start, end });
  }
  return out;
}

interface Fact {
  value: number;
  unit: NumberUnit;
  path: string;
}

/** Key naming in LlmFacts: `…Pt` is pt, `…Rate…` / `…Share…` is pct, the rest are counts. */
const unitOfKey = (key: string): NumberUnit => (key.endsWith('Pt') ? 'pt' : /Rate|Share/.test(key) ? 'pct' : 'count');

/** Every number in the facts, with the unit it is stated in. Strings (brand, period dates, findings) carry none. */
export function flattenFacts(facts: LlmFacts): Fact[] {
  const out: Fact[] = [];
  for (const section of ['funnel', 'delta', 'sources'] as const) {
    for (const [key, value] of Object.entries(facts[section])) {
      if (typeof value === 'number') out.push({ value, unit: unitOfKey(key), path: `${section}.${key}` });
    }
  }
  facts.topFindings.forEach((f, i) =>
    f.evidence.forEach((e, j) => {
      const path = `topFindings.${i}.evidence.${j}`;
      out.push({ value: e.value, unit: e.unit, path: `${path}.value` });
      if (e.of !== undefined) out.push({ value: e.of, unit: 'count', path: `${path}.of` });
    }),
  );
  return out;
}

const distance = (n: ExtractedNumber, f: Fact) => (n.unit === 'pt' ? Math.abs(Math.abs(n.value) - Math.abs(f.value)) : Math.abs(n.value - f.value));
const TOLERANCE: Record<NumberUnit, number> = { pct: 1, pt: 1, count: 0 };

export function verifyAgainstFacts(
  nums: ExtractedNumber[],
  facts: LlmFacts,
): Pick<LlmSummaryResult, 'numbers' | 'verification'> {
  const pool = flattenFacts(facts);
  const numbers: VerifiedNumber[] = nums.map((n) => {
    let best: Fact | undefined;
    for (const f of pool) {
      if (f.unit !== n.unit || distance(n, f) > TOLERANCE[n.unit]) continue;
      if (!best || distance(n, f) < distance(n, best)) best = f;
    }
    return best ? { ...n, verified: true, matchedFact: best.path } : { ...n, verified: false };
  });
  return { numbers, verification: verificationOf(numbers.filter((n) => n.verified).length, numbers.length) };
}
