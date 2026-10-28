import { getBrand, listProducts, listScenarios, listSeries } from '@geo/backend/knowledge/repo';
import { siteUrl } from '@geo/backend/shared/site';

// llms.txt (llmstxt.org): a plain-text map of the Knowledge Center for AI crawlers. Regenerated after admin writes.
export function GET(): Response {
  const base = siteUrl();
  const brand = getBrand();
  const products = listProducts({});
  const lines = [
    `# ${brand.name} Product Knowledge Center`,
    '',
    `> ${brand.description} Founded ${brand.founded}, ${brand.headquarters}.`,
    '',
    ...listSeries().flatMap((s) => [
      `## ${s.name}`,
      '',
      s.description,
      '',
      ...products
        .filter((p) => p.series.slug === s.slug)
        .map((p) => `- [${p.name}](${base}/products/${p.slug}): ${p.shortDescription} Key features: ${p.features.join(', ')}.`),
      '',
    ]),
    '## Scenarios',
    '',
    ...listScenarios().filter((s) => s.productCount > 0).map((s) => `- [${s.name}](${base}/scenarios/${s.slug}): ${s.description}`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
