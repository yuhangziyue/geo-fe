import { describe, expect, it } from 'vitest';
import { TRUTH_PCT_VALUES, TRUTH_PLATFORMS } from '../__fixtures__/truth';
import { fullFacts } from './__fixtures__/facts';
import { MOCK_MODEL_ID, MOCK_WRONG_PCT, summarize } from './mockProvider';

const facts = fullFacts();

describe('mockProvider (05 §6 demo switch)', () => {
  it('returns the fixed demo summary as mode mock, 5/6 verified (partial)', async () => {
    const r = await summarize(facts);
    expect(r.mode).toBe('mock');
    expect(r.model).toBe(MOCK_MODEL_ID);
    expect(r.reason).toBeNull();
    expect(r.numbers).toHaveLength(6);
    expect(r.verification).toEqual({ verified: 5, total: 6, band: 'partial' });
  });

  it('flags exactly one number, and it is the deliberate 31%', async () => {
    const r = await summarize(facts);
    const bad = r.numbers.filter((n) => !n.verified);
    expect(bad).toHaveLength(1);
    expect(bad[0].raw).toBe('31%');
    expect(bad[0].value).toBe(MOCK_WRONG_PCT);
    expect(r.text.slice(bad[0].start, bad[0].end)).toBe('31%');
    // it stands in for the weakest platform's real value
    const weakest = TRUTH_PLATFORMS.find((p) => p.isWorst)!;
    expect(r.text).toContain(`${weakest.name} at 31%`);
    expect(MOCK_WRONG_PCT).not.toBe(weakest.visibility);
  });

  it('hard guard: 31 is ≥ 2 pt away from every %-truth (re-run the brief §3 script if this turns red)', () => {
    expect(TRUTH_PCT_VALUES.length).toBeGreaterThan(0);
    expect(TRUTH_PCT_VALUES.every((t) => Math.abs(31 - t) >= 2)).toBe(true);
    expect(TRUTH_PCT_VALUES.every((t) => Math.abs(MOCK_WRONG_PCT - t) >= 2)).toBe(true);
  });

  it('is fixed text: only the brand name follows the facts', async () => {
    const a = await summarize(facts);
    const b = await summarize({ ...facts, brand: 'OtherBrand' });
    expect(b.text).toBe(a.text.replace(facts.brand, 'OtherBrand'));
  });
});
