import { describe, expect, it } from 'vitest';
import {
  GlobalFilterSchema,
  INTENT_LABELS,
  INTENTS,
  OWNED_DOMAIN,
  OWNED_DOMAIN_DISCLAIMER,
  QuestionQueryV3Schema,
  INTENT_DISPLAY_ORDER,
  INTENT_TIERS_DISCLAIMER,
  RULE_IDS,
  SummaryRequestSchema,
  compareActionCards,
  globalFilterHref,
  parseGlobalFilter,
  verificationOf,
  matrixCellLook,
  PLATFORMS,
  type ActionCard,
  type MatrixState,
} from './schema';
import { TRUTH_MATRIX } from './__fixtures__/truth';
import { loadQuestions } from './repo';

// v3 contract (T0). Owner: T0 — sub-tasks import these, they do not edit them.

describe('GlobalFilterSchema', () => {
  it('accepts the three dimensions, all optional', () => {
    expect(GlobalFilterSchema.parse({})).toEqual({});
    expect(GlobalFilterSchema.parse({ platform: 'DeepSeek', topic: 'Office Security', intent: 'A' })).toEqual({
      platform: 'DeepSeek',
      topic: 'Office Security',
      intent: 'A',
    });
  });

  it('rejects unknown platform and intent outside S/A/B/C', () => {
    expect(GlobalFilterSchema.safeParse({ platform: 'Foo' }).success).toBe(false);
    expect(GlobalFilterSchema.safeParse({ intent: 'X' }).success).toBe(false);
    expect(GlobalFilterSchema.safeParse({ topic: '' }).success).toBe(false);
  });
});

describe('QuestionQueryV3Schema', () => {
  it('adds intent and keeps the e2 list parameters', () => {
    expect(QuestionQueryV3Schema.parse({ intent: 'B', mentioned: 'false', page: '2' })).toEqual({
      intent: 'B',
      mentioned: false,
      page: 2,
      pageSize: 20,
    });
    expect(QuestionQueryV3Schema.safeParse({ intent: 'X' }).success).toBe(false);
    expect(QuestionQueryV3Schema.safeParse({ page: '-1' }).success).toBe(false);
  });
});

describe('SummaryRequestSchema', () => {
  it('requires a mode and takes the global filter', () => {
    expect(SummaryRequestSchema.parse({ mode: 'ai', intent: 'C' })).toEqual({ mode: 'ai', intent: 'C' });
    expect(SummaryRequestSchema.safeParse({}).success).toBe(false);
    expect(SummaryRequestSchema.safeParse({ mode: 'llm' }).success).toBe(false);
  });
});

describe('intent tiers and owned-domain disclaimer', () => {
  it('labels every tier once, weight ordered S > A > B > C', () => {
    expect(INTENTS).toEqual(['S', 'A', 'B', 'C']);
    expect(INTENTS.map((t) => INTENT_LABELS[t].name)).toEqual(['Decision', 'Evaluation', 'Solution', 'Awareness']);
    expect(INTENTS.map((t) => INTENT_LABELS[t].weight)).toEqual([4, 3, 2, 1]);
  });

  it('states the owned-domain assumption (F9) and names the domain used', () => {
    expect(OWNED_DOMAIN_DISCLAIMER).toBe('Owned = astervision.example (assumed; brand.json lists example.com/astervision).');
    expect(OWNED_DOMAIN_DISCLAIMER).toContain(OWNED_DOMAIN);
  });
});

describe('parseGlobalFilter (URL → filter)', () => {
  const params = (s: string) => new URLSearchParams(s);

  it('reads platform, topic and intent', () => {
    expect(parseGlobalFilter(params('platform=DeepSeek&topic=Office+Security&intent=A'))).toEqual({
      platform: 'DeepSeek',
      topic: 'Office Security',
      intent: 'A',
    });
  });

  it('ignores empty and invalid values one by one instead of dropping the whole filter', () => {
    expect(parseGlobalFilter(params('platform=Foo&topic=&intent=B'))).toEqual({ intent: 'B' });
  });

  it('ignores parameters that are not filters', () => {
    expect(parseGlobalFilter(params('simulate=slow&page=3&q=x'))).toEqual({});
  });
});

describe('globalFilterHref (filter → drill-down link)', () => {
  it('carries the filter in a fixed order: platform, topic, intent, then extras', () => {
    expect(globalFilterHref('/dashboard/questions', { intent: 'A', platform: 'Claude', topic: 'SMB Deployment' }, { mentioned: 'false' })).toBe(
      '/dashboard/questions?platform=Claude&topic=SMB+Deployment&intent=A&mentioned=false',
    );
  });

  it('lets an extra override the same filter key (e.g. clicking another platform)', () => {
    expect(globalFilterHref('/dashboard/questions', { platform: 'Claude' }, { platform: 'DeepSeek' })).toBe(
      '/dashboard/questions?platform=DeepSeek',
    );
  });

  it('returns the bare path when there is nothing to carry', () => {
    expect(globalFilterHref('/dashboard', {})).toBe('/dashboard');
  });

  it('round-trips through parseGlobalFilter', () => {
    const filter = { platform: 'Perplexity', topic: 'Low-light Imaging', intent: 'C' } as const;
    const href = globalFilterHref('/dashboard', filter);
    expect(parseGlobalFilter(new URL(href, 'http://x').searchParams)).toEqual(filter);
  });
});

describe('intent display order and ⓘ text', () => {
  it('displays tiers awareness → decision (C, B, A, S), the reverse of INTENTS', () => {
    expect(INTENT_DISPLAY_ORDER).toEqual([...INTENTS].reverse());
  });

  it('states the intent-tier convention once (05 §1)', () => {
    expect(INTENT_TIERS_DISCLAIMER).toBe(
      'Intent tiers follow the common purchase-funnel convention (S decision · A evaluation · B solution · C awareness). The dataset labels tiers but does not define them.',
    );
  });
});

describe('verificationOf (I2 ruling)', () => {
  it("is 'all' when every number checks out, or when there is no number at all", () => {
    expect(verificationOf(3, 3)).toEqual({ verified: 3, total: 3, band: 'all' });
    expect(verificationOf(0, 0)).toEqual({ verified: 0, total: 0, band: 'all' });
  });

  it("is 'low' below 50 % verified", () => {
    expect(verificationOf(1, 3).band).toBe('low');
    expect(verificationOf(0, 2).band).toBe('low');
  });

  it("is 'partial' from 50 % up to, not including, 100 %", () => {
    expect(verificationOf(1, 2).band).toBe('partial');
    expect(verificationOf(5, 6).band).toBe('partial');
  });
});

describe('compareActionCards (I5 ruling)', () => {
  const card = (id: ActionCard['id'], severity: ActionCard['severity'], affectedQuestions: number): ActionCard => ({
    id,
    severity,
    affectedQuestions,
    finding: '',
    evidence: [],
    action: '',
    evidenceHref: '/dashboard/questions',
    target: null,
  });

  it('sorts by severity, then affectedQuestions desc, then RULE_IDS order', () => {
    const cards = [
      card('decision-tier-untracked', 'low', 50),
      card('weak-topic', 'medium', 7),
      card('mention-not-recommended', 'medium', 29),
      card('owned-source-share', 'medium', 29),
      card('weak-platform', 'high', 1),
    ];
    expect([...cards].sort(compareActionCards).map((c) => c.id)).toEqual([
      'weak-platform',
      'mention-not-recommended',
      'owned-source-share',
      'weak-topic',
      'decision-tier-untracked',
    ]);
    expect(RULE_IDS.indexOf('mention-not-recommended')).toBeLessThan(RULE_IDS.indexOf('owned-source-share'));
  });
});

/*
 * The five-state rule of one matrix cell, in one place (T-FIX §3): the backend matrix (aggregations/matrix.ts) and the
 * detail page's replica (frontend detail/coverage.ts cellOf) both call it. Formerly F2's scratchpad test of cellOf.
 */
describe('matrixCellLook', () => {
  it('labels: r/n when all or some recommended, M, ✕, —', () => {
    expect(matrixCellLook(2, 2, 2)).toEqual({ state: 'recommended', label: '2/2' });
    expect(matrixCellLook(1, 1, 1)).toEqual({ state: 'recommended', label: '1/1' });
    expect(matrixCellLook(2, 1, 2)).toEqual({ state: 'partly', label: '1/2' });
    expect(matrixCellLook(2, 1, 1)).toEqual({ state: 'partly', label: '1/2' });
    expect(matrixCellLook(2, 0, 1)).toEqual({ state: 'mentioned_only', label: 'M' });
    expect(matrixCellLook(1, 0, 0)).toEqual({ state: 'not_mentioned', label: '✕' });
    expect(matrixCellLook(0, 0, 0)).toEqual({ state: 'not_tracked', label: '—' });
  });

  it('reproduces the matrix state distribution over every question × platform cell of questions.json', () => {
    const cells = new Map<string, { n: number; r: number; m: number }>();
    for (const q of loadQuestions()) {
      const k = `${q.question}|${q.platform}`;
      const c = cells.get(k) ?? { n: 0, r: 0, m: 0 };
      cells.set(k, { n: c.n + 1, r: c.r + Number(q.brand_recommended), m: c.m + Number(q.brand_mentioned) });
    }
    const counts: Record<MatrixState, number> = { recommended: 0, partly: 0, mentioned_only: 0, not_mentioned: 0, not_tracked: 0 };
    for (const c of cells.values()) counts[matrixCellLook(c.n, c.r, c.m).state] += 1;
    counts.not_tracked = TRUTH_MATRIX.rows * PLATFORMS.length - cells.size;
    expect(cells.size).toBe(TRUTH_MATRIX.trackedCells);
    expect(counts).toEqual(TRUTH_MATRIX.stateCounts);
  });
});
