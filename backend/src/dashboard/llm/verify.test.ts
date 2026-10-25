import { describe, expect, it } from 'vitest';
import type { ExtractedNumber, LlmFacts } from '../schema';
import { TRUTH_F3_F6, TRUTH_FUNNEL, TRUTH_OWNED_SHARE, TRUTH_PERIOD } from '../__fixtures__/truth';
import { fullFacts } from './__fixtures__/facts';
import { extractNumbers, verifyAgainstFacts } from './verify';

const facts = fullFacts();
const num = (value: number, unit: ExtractedNumber['unit']): ExtractedNumber => ({ raw: String(value), value, unit, start: 0, end: 0 });
const verdicts = (nums: ExtractedNumber[], f: LlmFacts = facts) => verifyAgainstFacts(nums, f).numbers.map((n) => n.verified);

describe('extractNumbers', () => {
  it('finds every number with its unit, in order (brief §5 example)', () => {
    expect(extractNumbers('Visibility is 71% with a -12 pt drop; 56 recommendations.').map(({ value, unit }) => ({ value, unit }))).toEqual([
      { value: 71, unit: 'pct' },
      { value: -12, unit: 'pt' },
      { value: 56, unit: 'count' },
    ]);
  });

  it('gives [start, end) offsets so that raw === text.slice(start, end), with no trailing space', () => {
    const text = 'Recommended 56 (47%), down 12 pt; 7/71 citations.';
    const nums = extractNumbers(text);
    expect(nums.map((n) => n.raw)).toEqual(['56', '47%', '12 pt', '7', '71']);
    for (const n of nums) expect(text.slice(n.start, n.end)).toBe(n.raw);
  });

  it('ignores digits glued to words (product names like "Nova X8") and reads decimals', () => {
    expect(extractNumbers('Nova X8 and H2O stay out; 46.5% is read.').map((n) => n.value)).toEqual([46.5]);
  });

  it('"12 points" is a count, not pt', () => {
    expect(extractNumbers('12 points')[0]).toMatchObject({ value: 12, unit: 'count' });
  });

  // T-FIX ① (B2 review minor 1): a number glued to the letters AFTER it is still a number the summary states.
  it('reads numbers glued to a unit or word after them: "12pp" / "12pts" are pt, "3x" is a count', () => {
    const text = 'Visibility fell 12pp (12pts) and DeepSeek trails 3x.';
    const nums = extractNumbers(text);
    expect(nums.map(({ raw, value, unit }) => ({ raw, value, unit }))).toEqual([
      { raw: '12pp', value: 12, unit: 'pt' },
      { raw: '12pts', value: 12, unit: 'pt' },
      { raw: '3x', value: 3, unit: 'count' },
    ]);
    for (const n of nums) expect(text.slice(n.start, n.end)).toBe(n.raw);
  });

  it('glued numbers take part in the check: a made-up "3x" is red, "12pp" verifies against the −12 pt delta', () => {
    const r = verifyAgainstFacts(extractNumbers(`down ${Math.abs(TRUTH_PERIOD.deltaPt)}pp, ${TRUTH_FUNNEL.questions + 1}x more`), facts);
    expect(r.numbers.map((n) => [n.raw, n.verified])).toEqual([
      [`${Math.abs(TRUTH_PERIOD.deltaPt)}pp`, true],
      [`${TRUTH_FUNNEL.questions + 1}x`, false],
    ]);
  });

  it('still skips numbers glued to the letters BEFORE them — version / model names ("v1.2", "Nova X8") and ordinals ("1st", "2nd")', () => {
    // A version or a product name is not a claim about the data; an ordinal is a rank, not a measured value.
    expect(extractNumbers('Model v1.2 on Nova X8, ranked 1st and 2nd.')).toEqual([]);
  });

  // T-FIX ② (B2 review minor 2): a hyphen right after a % is a range separator, not a minus sign.
  it.each([
    ['77%-65%', 'hyphen'],
    ['77%–65%', 'en dash'],
    ['77% → 65%', 'arrow'],
    ['77% - 65%', 'spaced hyphen'],
  ])('"%s" (%s) reads 77% then 65%, not −65%', (range) => {
    expect(extractNumbers(`from ${range} visibility`).map(({ value, unit }) => ({ value, unit }))).toEqual([
      { value: 77, unit: 'pct' },
      { value: 65, unit: 'pct' },
    ]);
  });

  it('a range of the true halves verifies both ends', () => {
    const text = `Visibility went from ${TRUTH_PERIOD.first.pct}%-${TRUTH_PERIOD.last.pct}%.`;
    expect(verifyAgainstFacts(extractNumbers(text), facts).verification).toEqual({ verified: 2, total: 2, band: 'all' });
  });

  it('a leading minus is still a sign: "-12 pt" and "(-12 pt)"', () => {
    expect(extractNumbers('a -12 pt drop (-12 pt)').map((n) => n.value)).toEqual([-12, -12]);
  });

  // T-FIX ③ (B2 review minor 3): thousands separators.
  it('"1,200" is 1200, not 1 and 200; a list "7, 71" stays two numbers', () => {
    const text = 'Across 1,200 runs and 12,345,678 tokens; 7, 71 and 7,71.';
    const nums = extractNumbers(text);
    expect(nums.map(({ raw, value }) => ({ raw, value }))).toEqual([
      { raw: '1,200', value: 1200 },
      { raw: '12,345,678', value: 12345678 },
      { raw: '7', value: 7 },
      { raw: '71', value: 71 },
      { raw: '7', value: 7 },
      { raw: '71', value: 71 },
    ]);
    for (const n of nums) expect(text.slice(n.start, n.end)).toBe(n.raw);
  });

  it('returns [] for text without numbers', () => {
    expect(extractNumbers('No numbers here.')).toEqual([]);
  });
});

describe('verifyAgainstFacts', () => {
  it('matches the funnel truths (brief §5: 71% ✓, 70% within ±1 ✓, 66 ✓)', () => {
    const r = verifyAgainstFacts(
      [num(TRUTH_FUNNEL.mentions.rateOfAsked, 'pct'), num(TRUTH_FUNNEL.mentions.rateOfAsked - 1, 'pct'), num(TRUTH_FUNNEL.recommendations.rateOfPrevious, 'pct')],
      facts,
    );
    expect(r.numbers.map((n) => n.verified)).toEqual([true, true, true]);
    expect(r.numbers[0].matchedFact).toBe('funnel.mentionRateOfAsked');
    expect(r.numbers[2].matchedFact).toBe('funnel.recommendRateOfMentioned');
    expect(r.verification).toEqual({ verified: 3, total: 3, band: 'all' });
  });

  it('tolerance edge: fact 71% → 72% ✓, 73% ✗', () => {
    const base = TRUTH_FUNNEL.mentions.rateOfAsked;
    // 73 must not hit another pct fact by accident, or the edge test proves nothing
    expect(verdicts([num(base + 1, 'pct'), num(base + 2, 'pct')])).toEqual([true, false]);
  });

  it('counts are exact: fact 56 → 57 ✗', () => {
    expect(verdicts([num(TRUTH_FUNNEL.recommendations.value, 'count'), num(TRUTH_FUNNEL.recommendations.value + 1, 'count')])).toEqual([true, false]);
  });

  it('units must agree: 71 as a count matches totalCitations, 120% matches nothing', () => {
    const r = verifyAgainstFacts([num(TRUTH_OWNED_SHARE.totalCitations, 'count'), num(TRUTH_FUNNEL.questions, 'pct')], facts);
    expect(r.numbers.map((n) => n.verified)).toEqual([true, false]);
    expect(r.numbers[0].matchedFact).toBe('sources.totalCitations');
    expect(r.numbers[1].matchedFact).toBeUndefined();
  });

  it('pt matches the period delta by size, so "dropped 12 pt" and "-12 pt" both verify', () => {
    expect(verdicts([num(TRUTH_PERIOD.deltaPt, 'pt'), num(-TRUTH_PERIOD.deltaPt, 'pt'), num(TRUTH_PERIOD.deltaPt - 2, 'pt')])).toEqual([true, true, false]);
  });

  it('evidence numbers are facts too, with their own unit and their `of` as a count', () => {
    const r = verifyAgainstFacts([num(TRUTH_F3_F6.mentionedNotRecommended, 'count'), num(TRUTH_F3_F6.notMentioned, 'count')], facts);
    expect(r.numbers.every((n) => n.verified)).toBe(true);
    expect(r.numbers[0].matchedFact).toMatch(/^topFindings\.\d+\.evidence\.\d+\.value$/);
  });

  it('band follows verificationOf: 3/3 all · 2/3 partial · 1/3 low · 0/3 low · 0/0 all', () => {
    const ok = num(TRUTH_FUNNEL.questions, 'count');
    const bad = num(TRUTH_FUNNEL.questions + 1, 'count');
    const band = (nums: ExtractedNumber[]) => verifyAgainstFacts(nums, facts).verification;
    expect(band([ok, ok, ok])).toEqual({ verified: 3, total: 3, band: 'all' });
    expect(band([ok, ok, bad])).toEqual({ verified: 2, total: 3, band: 'partial' });
    expect(band([ok, bad, bad])).toEqual({ verified: 1, total: 3, band: 'low' });
    expect(band([bad, bad, bad])).toEqual({ verified: 0, total: 3, band: 'low' });
    expect(band([])).toEqual({ verified: 0, total: 0, band: 'all' });
  });

  it('keeps raw / start / end of every number', () => {
    const text = 'Visibility is 71%.';
    const [n] = verifyAgainstFacts(extractNumbers(text), facts).numbers;
    expect(n).toMatchObject({ raw: '71%', start: 14, end: 17, verified: true });
  });
});
