// Response shapes of /api/dashboard/* — owned by the backend, imported as types only (nothing ships to the client).
export type {
  Citation,
  Facets,
  Insight,
  MetricRow as Kpi,
  Question,
  QuestionDetailResponse as QuestionDetail,
  QuestionPageResponse as QuestionPage,
  SummaryResponse as Summary,
} from '@geo/backend/dashboard/schema';
