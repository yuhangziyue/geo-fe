import type { MetadataRoute } from 'next';
import { listProducts, listScenarios } from '@geo/backend/knowledge/repo';

// Only public Knowledge Center pages; dashboard, admin and API stay out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return [
    { url: `${base}/products`, changeFrequency: 'weekly', priority: 1 },
    ...listProducts({}).map((p) => ({ url: `${base}/products/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    // Scenarios with no linked product are thin pages: kept reachable, left out of the index.
    ...listScenarios().filter((s) => s.productCount > 0).map((s) => ({ url: `${base}/scenarios/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
