import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { buildActions, factsForLlm } from './insight';
import { DEFAULT_ANTHROPIC_MODEL, LlmTimeoutError, isLlmEnabled, resolveModel, summarize } from './llm/claude';
import { dispatchSummary } from './llm/dispatcher';
import { MOCK_MODEL_ID, summarize as mockSummarize } from './llm/mockProvider';
import { buildUserPrompt, SYSTEM_PROMPT } from './llm/prompts';
import { buildTemplateSummary } from './llm/template';
import { extractNumbers, verifyAgainstFacts } from './llm/verify';
import type {
  ActionCard,
  ExtractedNumber,
  FunnelKpi,
  GlobalFilter,
  LlmFacts,
  LlmSummaryResult,
  PeriodHalves,
  Question,
  SummaryMode,
  SummaryV3DTO,
  TopicScenarioMap,
} from './schema';

/*
 * The T0 handshake between B1 / B2 / F1 / F2. The type assertions are checked by
 * `pnpm --dir <wt>/backend exec tsc --noEmit -p .` (vitest itself does not type-check): if anyone changes a
 * signature below, that command goes red. Owner: T0. Changing a signature = stop and report NEEDS_CONTEXT.
 */
describe('T0 signatures', () => {
  it('insight.ts: buildActions / factsForLlm', () => {
    expectTypeOf(buildActions).parameters.toEqualTypeOf<[Question[], GlobalFilter, TopicScenarioMap]>();
    expectTypeOf(buildActions).returns.toEqualTypeOf<ActionCard[]>();
    expectTypeOf(factsForLlm).parameters.toEqualTypeOf<
      [ActionCard[], Pick<SummaryV3DTO, 'brand' | 'funnel' | 'periodHalves' | 'sources'>]
    >();
    expectTypeOf(factsForLlm).returns.toEqualTypeOf<LlmFacts>();
  });

  it('llm/*: summarize, template, verify, dispatcher, mock, prompts', () => {
    expectTypeOf(summarize).returns.toEqualTypeOf<Promise<LlmSummaryResult>>();
    expectTypeOf(summarize).parameter(0).toEqualTypeOf<LlmFacts>();
    expectTypeOf(buildTemplateSummary).parameters.toEqualTypeOf<[LlmFacts, LlmSummaryResult['reason']?]>();
    expectTypeOf(buildTemplateSummary).returns.toEqualTypeOf<LlmSummaryResult>();
    expectTypeOf(extractNumbers).parameters.toEqualTypeOf<[string]>();
    expectTypeOf(extractNumbers).returns.toEqualTypeOf<ExtractedNumber[]>();
    expectTypeOf(verifyAgainstFacts).parameters.toEqualTypeOf<[ExtractedNumber[], LlmFacts]>();
    expectTypeOf(verifyAgainstFacts).returns.toEqualTypeOf<
      Pick<LlmSummaryResult, 'numbers' | 'verifiedRatio' | 'verifiedBand'>
    >();
    expectTypeOf(dispatchSummary).parameters.toEqualTypeOf<[SummaryMode, LlmFacts]>();
    expectTypeOf(dispatchSummary).returns.toEqualTypeOf<Promise<LlmSummaryResult>>();
    expectTypeOf(mockSummarize).parameters.toEqualTypeOf<[LlmFacts]>();
    expectTypeOf(mockSummarize).returns.toEqualTypeOf<Promise<LlmSummaryResult>>();
    expectTypeOf(buildUserPrompt).parameters.toEqualTypeOf<[LlmFacts]>();
    expectTypeOf(SYSTEM_PROMPT).toEqualTypeOf<string>();
  });

  it('TopicScenarioMap can be empty (mapping file deleted) and holds null for "deliberately no scenario"', () => {
    const empty: TopicScenarioMap = new Map();
    expect(empty.size).toBe(0);
    const curated: TopicScenarioMap = new Map([
      ['Office Security', { slug: 'office', name: 'Office' }],
      ['Product Comparison', null],
    ]);
    expect(curated.get('Office Security')?.slug).toBe('office');
    expect(curated.get('Product Comparison')).toBeNull();
    expect(curated.has('Unknown topic')).toBe(false);
  });

  it('periodHalves has one named type', () => {
    expectTypeOf<SummaryV3DTO['periodHalves']>().toEqualTypeOf<PeriodHalves>();
    expectTypeOf<FunnelKpi['mentions']['deltaPt']>().toEqualTypeOf<number | null>();
  });
});

describe('llm/claude.ts: model and key (implemented in T0)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to claude-opus-5-5, overridable by ANTHROPIC_MODEL', () => {
    expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-opus-5-5');
    vi.stubEnv('ANTHROPIC_MODEL', '');
    expect(resolveModel()).toBe(DEFAULT_ANTHROPIC_MODEL);
    vi.stubEnv('ANTHROPIC_MODEL', 'some-other-model');
    expect(resolveModel()).toBe('some-other-model');
  });

  it('is enabled only with an API key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(isLlmEnabled()).toBe(false);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    expect(isLlmEnabled()).toBe(true);
  });

  it('exports a timeout error class the dispatcher can map to reason "timeout"', () => {
    const e = new LlmTimeoutError(15_000);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('LlmTimeoutError');
  });

  it('names the mock model', () => {
    expect(MOCK_MODEL_ID).toBe('mock-llm-v1');
  });
});
