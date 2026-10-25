import type { MetadataRoute } from 'next';
import { listProducts, listScenarios } from '@geo/backend/knowledge/repo';
import { siteUrl } from '@geo/backend/shared/site';

// Only public Knowledge Center pages; dashboard, admin and API stay out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/products`, changeFrequency: 'weekly', priority: 1 },
    ...listProducts({}).map((p) => ({ url: `${base}/products/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    // Scenarios with no linked product are thin pages: kept reachable, left out of the index.
    ...listScenarios().filter((s) => s.productCount > 0).map((s) => ({ url: `${base}/scenarios/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
