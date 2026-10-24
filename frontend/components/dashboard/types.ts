// Response shapes of /api/dashboard/* (mirrors backend/src/dashboard/http.ts).
export interface Kpi {
  visibility: number;
  mentions: number;
  recommendations: number;
  citations: number;
  citedQuestions: number;
  questions: number;
}
export interface Summary {
  brand: string;
  period: string;
  kpi: Kpi;
  platforms: Array<Kpi & { name: string }>;
  trend: Array<{ date: string; visibility: number; mentions: number; recommendations: number }>;
  topics: Array<{ topic: string; questions: number; visibility: number; recommendations: number }>;
  worstQuestions: Array<{ id: number; question: string; platform: string; topic: string }>;
}
export interface Citation {
  title: string;
  url: string;
  source_type: string;
}
export interface Question {
  id: number;
  date: string;
  platform: string;
  topic: string;
  intent_type: string;
  question: string;
  brand_mentioned: boolean;
  brand_recommended: boolean;
  sentiment: string;
  mentioned_products: string[];
  answer_excerpt: string;
  citations: Citation[];
  citation_count: number;
}
export interface QuestionPage {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
}
export interface QuestionDetail {
  question: Question;
  crossPlatform: Array<{ id: number; platform: string; date: string; mentioned: boolean; recommended: boolean }>;
  analysis: {
    citationDomains: Array<{ domain: string; count: number; owned: boolean }>;
    ownedCitations: number;
    products: Array<{ name: string; slug: string | null }>;
  };
}
export interface Insight {
  id: string;
  title: string;
  detail: string;
  evidenceHref: string;
}

export const PLATFORMS = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'DeepSeek'] as const;
export const TOPICS = [
  'Warehouse Security',
  'Retail Analytics',
  'Office Security',
  'Perimeter Protection',
  'Low-light Imaging',
  'SMB Deployment',
  'Industrial Monitoring',
  'Product Comparison',
] as const;
