import type { MetadataRoute } from 'next';
import { siteUrl } from '@geo/backend/shared/site';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/api'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
