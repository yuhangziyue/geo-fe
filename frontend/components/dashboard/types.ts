// Response shapes of /api/dashboard/* — owned by the backend; components import them from here, never keep a copy.
// Owner: T0 (see __contracts__/README.md). The type exports are erased at build time. The value exports at the bottom
// (and useGlobalFilter's URL helpers) DO ship schema.ts to the browser, zod included — accepted: zod is already a
// frontend dependency and this keeps one definition of each constant.

// e2 (v2) shapes, kept only while the old components exist. F1/F2 delete those components; T-END removes these.
export type {
  Insight,
  MetricRow as Kpi,
  QuestionDetailResponse as QuestionDetail,
  SummaryResponse as SummaryV2,
} from '@geo/backend/dashboard/schema';

// Shared by v2 and v3.
export type { Citation, Facets, Platform, Question, QuestionPageResponse as QuestionPage } from '@geo/backend/dashboard/schema';

// v3 contract.
export type {
  ActionCard,
  ActionCardsResponse,
  ActionTarget,
  Diagnosis,
  DiagnosisCode,
  EvidenceDatum,
  FunnelKpi,
  FunnelStep,
  GlobalFilter,
  IntentRow,
  IntentTier,
  LlmFacts,
  LlmSummaryResult,
  MatrixCell,
  MatrixDTO,
  MatrixRow,
  MatrixState,
  NumberUnit,
  PeriodHalves,
  PlatformRow,
  QuestionDetailV3,
  QuestionDetailV3Response,
  RuleId,
  Severity,
  SourceStructure,
  SummaryMode,
  SummaryRequest,
  SummaryResultMode,
  SummaryV3DTO,
  SummaryV3Response as Summary,
  TargetKind,
  TopicRow,
  TrendPoint,
  Verification,
  VerifiedNumber,
} from '@geo/backend/dashboard/schema';

// ⓘ texts and the fixed vocabularies — one definition, shared with the backend.
export {
  INTENT_DISPLAY_ORDER,
  INTENT_LABELS,
  INTENT_TIERS_DISCLAIMER,
  INTENTS,
  OWNED_DOMAIN_DISCLAIMER,
  PLATFORMS,
  SOURCE_TYPE_NOTE,
} from '@geo/backend/dashboard/schema';
