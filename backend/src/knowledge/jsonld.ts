import type { Brand, ProductDetail, ScenarioDetail } from './schema';

// Pure function: page and JSON-LD render from the same ProductDetail so markup matches visible content.
// No `offers` / ratings: the dataset has no prices and we do not invent them.
export function buildJsonLd(brand: Brand, product: ProductDetail, siteUrl: string): object {
  const base = siteUrl.replace(/\/$/, '');
  const url = `${base}/products/${product.slug}`;
  const orgId = `${base}/#org`;
  const props = [
    ...product.features.map((f) => ({ name: 'Key feature', value: f })),
    product.specs.resolution ? { name: 'Resolution', value: product.specs.resolution } : null,
    { name: 'Connectivity', value: product.specs.connectivity },
    { name: 'Environment', value: product.specs.environment },
    ...product.specs.aiFeatures.map((f) => ({ name: 'AI feature', value: f })),
  ].filter((x): x is { name: string; value: string } => x !== null);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(brand, orgId),
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: product.name,
        url,
        description: product.overview,
        sku: product.slug,
        category: product.series.name,
        brand: { '@id': orgId },
        // Only a real edit time; seeded content has none and gets no invented date.
        ...(product.updatedAt ? { dateModified: product.updatedAt } : {}),
        additionalProperty: props.map((p) => ({ '@type': 'PropertyValue', ...p })),
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        about: { '@id': `${url}#product` },
        mainEntity: product.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Products', item: `${base}/products` },
          { '@type': 'ListItem', position: 2, name: product.series.name, item: `${base}/products?series=${product.series.slug}` },
          { '@type': 'ListItem', position: 3, name: product.name, item: url },
        ],
      },
    ],
  };
}

function organizationNode(brand: Brand, orgId: string): object {
  return {
    '@type': 'Organization',
    '@id': orgId,
    name: brand.name,
    url: brand.website,
    description: brand.description,
    foundingDate: brand.founded,
    address: brand.headquarters,
    knowsAbout: brand.coreCapabilities,
  };
}

// Scenario page = the scenario entity as a collection of the products that name it in best_for.
export function buildScenarioJsonLd(brand: Brand, scenario: ScenarioDetail, siteUrl: string): object {
  const base = siteUrl.replace(/\/$/, '');
  const url = `${base}/scenarios/${scenario.slug}`;
  const orgId = `${base}/#org`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(brand, orgId),
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: `${scenario.name} security products`,
        description: scenario.description,
        publisher: { '@id': orgId },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: scenario.products.map((p, i) => ({
            '@type': 'ListItem', position: i + 1, name: p.name, url: `${base}/products/${p.slug}`,
          })),
        },
      },
    ],
  };
}
