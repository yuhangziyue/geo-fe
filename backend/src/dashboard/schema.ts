import { z } from 'zod';

export const PLATFORMS = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'DeepSeek'] as const;
export const OWNED_DOMAIN = 'astervision.example';

export const CitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  source_type: z.string(),
});

export const QuestionSchema = z.object({
  id: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(PLATFORMS),
  topic: z.string(),
  intent_type: z.string(),
  question: z.string(),
  brand_mentioned: z.boolean(),
  brand_recommended: z.boolean(),
  sentiment: z.string(),
  mentioned_products: z.array(z.string()),
  answer_excerpt: z.string(),
  citations: z.array(CitationSchema),
  citation_count: z.number().int(),
});

export type Citation = z.infer<typeof CitationSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Platform = (typeof PLATFORMS)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const SummaryFilterSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type SummaryFilter = z.infer<typeof SummaryFilterSchema>;

export const QuestionQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
  mentioned: bool.optional(),
  recommended: bool.optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type QuestionQuery = z.infer<typeof QuestionQuerySchema>;

export const InsightBodySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  topic: z.string().min(1).optional(),
});

export interface MetricRow {
  visibility: number;
  mentions: number;
  recommendations: number;
  citations: number;
  citedQuestions: number;
  questions: number;
}

export interface SummaryDTO {
  brand: string;
  period: string;
  kpi: MetricRow;
  platforms: Array<MetricRow & { name: string }>;
  trend: Array<{ date: string; visibility: number; mentions: number; recommendations: number }>;
  topics: Array<{ topic: string; questions: number; visibility: number; recommendations: number }>;
  worstQuestions: Array<{ id: number; question: string; platform: string; topic: string }>;
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  evidenceHref: string;
}
