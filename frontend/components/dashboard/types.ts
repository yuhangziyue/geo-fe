// Response shapes of /api/dashboard/* — owned by the backend; components import them from here, never keep a copy.
// Owner: T0 (see __contracts__/README.md). The type exports are erased at build time. The value exports at the bottom
// (and useGlobalFilter's URL helpers) DO ship schema.ts to the browser, zod included — accepted: zod is already a
// frontend dependency and this keeps one definition of each constant.

// Shared with e2 (unchanged list / question shapes).
export type { Citation, Facets, Platform, Question, QuestionPageResponse as QuestionPage } from '@geo/backend/dashboard/schema';

// v3 contract.
export type {
  ActionCard,
  ActionCardsResponse,
  ActionTarget,
  AttributionDTO,
  AttributionDimension,
  AttributionRow,
  AttributionShift,
  AttributionVerdict,
  Diagnosis,
  DiagnosisCode,
  EvidenceDatum,
  FunnelKpi,
  FunnelStep,
  GlobalFilter,
  HalfBucket,
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

// ⓘ texts, the fixed vocabularies and the matrix five-state rule — one definition, shared with the backend.
export {
  INTENT_DISPLAY_ORDER,
  INTENT_LABELS,
  INTENT_TIERS_DISCLAIMER,
  INTENTS,
  matrixCellLook,
  OWNED_DOMAIN_DISCLAIMER,
  PLATFORMS,
  SOURCE_TYPE_NOTE,
} from '@geo/backend/dashboard/schema';
