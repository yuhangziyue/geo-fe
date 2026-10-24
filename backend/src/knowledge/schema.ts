import { z } from 'zod';

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const list = (label: string) => z.array(z.string().trim().min(1)).min(1, `${label} needs at least one item`);

// Shared by the admin form (client) and the write API (server).
export const ProductInput = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase letters, digits and hyphens'),
  name: nonEmpty('name'),
  seriesSlug: nonEmpty('series'),
  status: z.enum(['active', 'beta']),
  shortDescription: nonEmpty('short description'),
  overview: nonEmpty('overview'),
  keyFeatures: list('key features'),
  bestFor: list('best for'),
  specs: z.object({
    resolution: z.string().trim().min(1).nullable(),
    connectivity: nonEmpty('connectivity'),
    environment: nonEmpty('environment'),
    aiFeatures: z.array(z.string().trim().min(1)),
  }),
});
export type ProductInput = z.infer<typeof ProductInput>;

export type FieldErrors = Record<string, string>;

export function fieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export type Specs = { resolution: string | null; connectivity: string; environment: string; aiFeatures: string[] };

export type ProductSummary = {
  slug: string; name: string; status: 'active' | 'beta'; shortDescription: string; features: string[];
  series: { slug: string; name: string };
  specs: Omit<Specs, 'aiFeatures'>;
};

export type ProductDetail = ProductSummary & {
  id: number;
  overview: string;
  bestFor: Array<{ label: string; scenarioSlug: string | null }>;
  faqs: Array<{ id: number; position: number; question: string; answer: string }>;
  specs: Specs;
  seriesSiblings: Array<{ slug: string; name: string; status: 'active' | 'beta'; specs: Specs }>;
};

export type Brand = { name: string; slug: string; description: string; website: string; founded: string; headquarters: string; coreCapabilities: string[] };
export type SeriesInfo = { slug: string; name: string; description: string; productCount: number };

export type ScenarioInfo = { slug: string; name: string; description: string };
export type ScenarioDetail = ScenarioInfo & { products: ProductSummary[] };
