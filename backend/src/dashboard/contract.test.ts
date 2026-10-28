import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { buildActions, factsForLlm } from './insight';
import { DEFAULT_MODEL, LlmTimeoutError, isLlmEnabled, resolveModel, summarize } from './llm/claude';
import { dispatchSummary } from './llm/dispatcher';
import { summarize as mockSummarize } from './llm/mockProvider';
import { buildUserPrompt, SYSTEM_PROMPT } from './llm/prompts';
import { buildTemplateSummary } from './llm/template';
import { extractNumbers, verifyAgainstFacts } from './llm/verify';
import type {
  ActionCard,
  ActionTarget,
  Diagnosis,
  EvidenceDatum,
  ExtractedNumber,
  FunnelKpi,
  GlobalFilter,
  LlmFacts,
  LlmSummaryResult,
  MatrixCell,
  MatrixDTO,
  NumberUnit,
  PeriodHalves,
  Platform,
  PlatformRow,
  Question,
  SummaryMode,
  SummaryV3DTO,
  TopicScenarioMap,
  TrendPoint,
  Verification,
} from './schema';

/*
 * The T0 handshake between B1 / B2 / F1 / F2. The type assertions are checked by
 * `pnpm --dir <wt>/backend exec tsc --noEmit -p .` (vitest itself does not type-check): if anyone changes a
 * signature below, that command goes red. Owner: T0. Changing a signature = stop and report NEEDS_CONTEXT.
 * T-FIX (controller ruling) added: MatrixCell.latestDate, TrendPoint.{daily,rolling}{Mentions,Questions},
 * LlmSummaryResult.reason 'unknown_provider'.
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
    expectTypeOf(verifyAgainstFacts).returns.toEqualTypeOf<Pick<LlmSummaryResult, 'numbers' | 'verification'>>();
    expectTypeOf(dispatchSummary).parameters.toEqualTypeOf<[SummaryMode, LlmFacts]>();
    expectTypeOf(dispatchSummary).returns.toEqualTypeOf<Promise<LlmSummaryResult>>();
    expectTypeOf(mockSummarize).parameters.toEqualTypeOf<[LlmFacts]>();
    expectTypeOf(mockSummarize).returns.toEqualTypeOf<Promise<LlmSummaryResult>>();
    expectTypeOf(buildUserPrompt).parameters.toEqualTypeOf<[LlmFacts]>();
    expectTypeOf(SYSTEM_PROMPT).toEqualTypeOf<string>();
  });

  it('review round 1 shapes (C1, C2, I2–I8)', () => {
    // C1: the diagnosis target says what kind of link it is ("manual mapping" for scenarios).
    expectTypeOf<Diagnosis['target']>().toEqualTypeOf<ActionTarget | null>();
    // C2: evidence numbers carry a unit; one unit vocabulary for evidence and extracted numbers.
    expectTypeOf<EvidenceDatum['unit']>().toEqualTypeOf<NumberUnit>();
    expectTypeOf<NumberUnit>().toEqualTypeOf<'pct' | 'pt' | 'count'>();
    // I2: numeric verification with one band rule.
    expectTypeOf<LlmSummaryResult['verification']>().toEqualTypeOf<Verification>();
    expectTypeOf<Verification['band']>().toEqualTypeOf<'all' | 'partial' | 'low'>();
    // I3: offsets into the summary text.
    expectTypeOf<ExtractedNumber>().toHaveProperty('start').toEqualTypeOf<number>();
    expectTypeOf<ExtractedNumber>().toHaveProperty('end').toEqualTypeOf<number>();
    // I4: the result mode names the source; the request mode stays ai | rules.
    expectTypeOf<LlmSummaryResult['mode']>().toEqualTypeOf<'rules' | 'ai' | 'mock'>();
    expectTypeOf<SummaryMode>().toEqualTypeOf<'ai' | 'rules'>();
    // I5: cards carry their impact.
    expectTypeOf<ActionCard['affectedQuestions']>().toEqualTypeOf<number>();
    // I6: empty days / windows are null, not 0 %.
    expectTypeOf<TrendPoint['dailyVisibility']>().toEqualTypeOf<number | null>();
    expectTypeOf<TrendPoint['rollingVisibility']>().toEqualTypeOf<number | null>();
    // I7: the matrix ignores the platform filter and says whether to start collapsed.
    expectTypeOf<MatrixDTO['collapsedByDefault']>().toEqualTypeOf<boolean>();
    expectTypeOf<MatrixDTO['platforms']>().toEqualTypeOf<readonly Platform[]>();
    // I8: every funnel rate names its denominator; deltaPt belongs to rateOfAsked.
    expectTypeOf<FunnelKpi['mentions']>().toEqualTypeOf<{ value: number; rateOfAsked: number; rateOfPrevious: number; deltaPt: number | null }>();
    expectTypeOf<FunnelKpi['recommendations']>().toEqualTypeOf<FunnelKpi['mentions']>();
    expectTypeOf<FunnelKpi['questions']>().toEqualTypeOf<{ value: number }>();
    expectTypeOf<LlmFacts['funnel']>().toHaveProperty('recommendRateOfAsked').toEqualTypeOf<number>();
    expectTypeOf<PlatformRow['name']>().toEqualTypeOf<Platform>();
  });

  it('T-FIX shapes: matrix latest date, trend numerators, unknown_provider reason', () => {
    // MatrixCell: date of the latest run, for the "Latest run <Mon D>" tooltip; null when not_tracked.
    expectTypeOf<MatrixCell['latestDate']>().toEqualTypeOf<string | null>();
    // TrendPoint: the numerators behind "Aug 4 · 4/4 mentioned (n=4)" and "7-day: 22/28 (79%)"; 0 when empty.
    expectTypeOf<TrendPoint['dailyMentions']>().toEqualTypeOf<number>();
    expectTypeOf<TrendPoint['dailyQuestions']>().toEqualTypeOf<number>();
    expectTypeOf<TrendPoint['rollingMentions']>().toEqualTypeOf<number>();
    expectTypeOf<TrendPoint['rollingQuestions']>().toEqualTypeOf<number>();
    // An unknown LLM_PROVIDER is its own reason, not no_api_key.
    expectTypeOf<LlmSummaryResult['reason']>().toEqualTypeOf<'no_api_key' | 'unknown_provider' | 'timeout' | 'upstream_error' | null | undefined>();
  });

  it('TopicScenarioMap accepts an empty Map (mapping file deleted)', () => {
    expectTypeOf<Map<string, never>>().toMatchTypeOf<TopicScenarioMap>();
  });

  it('periodHalves has one named type', () => {
    expectTypeOf<SummaryV3DTO['periodHalves']>().toEqualTypeOf<PeriodHalves>();
  });

  it('P1: platformTrends maps every platform to its own TrendPoint series', () => {
    expectTypeOf<SummaryV3DTO['platformTrends']>().toEqualTypeOf<Record<Platform, TrendPoint[]>>();
  });
});

describe('llm/claude.ts: model and key (implemented in T0)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('falls back to DEFAULT_MODEL when ANTHROPIC_MODEL is unset or empty, and honours an override', () => {
    vi.stubEnv('ANTHROPIC_MODEL', '');
    expect(resolveModel()).toBe(DEFAULT_MODEL);
    vi.stubEnv('ANTHROPIC_MODEL', 'override-model');
    expect(resolveModel()).toBe('override-model');
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
});
