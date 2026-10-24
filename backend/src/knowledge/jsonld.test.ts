import { beforeAll, describe, expect, it } from 'vitest';
import { useTempDb } from './test-db';
import { getBrand, getProduct, getScenario } from './repo';
import { buildJsonLd, buildScenarioJsonLd } from './jsonld';

type Node = Record<string, any>;

describe('buildJsonLd', () => {
  beforeAll(() => {
    useTempDb('jsonld');
  });

  it('emits one @graph linking Product.brand to the Organization', () => {
    const product = getProduct('nova-x4')!;
    const ld = buildJsonLd(getBrand(), product, 'https://site.test') as { '@context': string; '@graph': Node[] };
    const byType = (type: string) => ld['@graph'].find((n) => n['@type'] === type)!;
    expect(ld['@context']).toBe('https://schema.org');
    for (const type of ['Organization', 'Product', 'FAQPage', 'BreadcrumbList']) expect(byType(type)).toBeTruthy();
    expect(byType('Organization')['@id']).toBe('https://site.test/#org');
    expect(byType('Product').brand['@id']).toBe(byType('Organization')['@id']);
    expect(byType('FAQPage').mainEntity).toHaveLength(product.faqs.length);
    expect(byType('Product')).not.toHaveProperty('offers');
    expect(byType('Product')).not.toHaveProperty('dateModified'); // imported, never edited: no invented date
    expect(byType('Product').url).toBe('https://site.test/products/nova-x4');
  });

  it('carries every visible key feature, so an admin edit shows up in the markup too', () => {
    const product = getProduct('nova-x4')!;
    const ld = buildJsonLd(getBrand(), product, 'https://site.test') as { '@graph': Node[] };
    const productNode = ld['@graph'].find((n) => n['@type'] === 'Product')!;
    const keyFeatures = productNode.additionalProperty
      .filter((p: Node) => p.name === 'Key feature')
      .map((p: Node) => p.value);
    expect(keyFeatures).toEqual(product.features);
  });
});

describe('buildScenarioJsonLd', () => {
  beforeAll(() => {
    useTempDb('jsonld-scenario');
  });

  it('emits a CollectionPage whose ItemList links each product page, publisher = the Organization', () => {
    const scenario = getScenario('warehouse')!;
    const ld = buildScenarioJsonLd(getBrand(), scenario, 'https://site.test') as { '@graph': Node[] };
    const page = ld['@graph'].find((n) => n['@type'] === 'CollectionPage')!;
    expect(page.url).toBe('https://site.test/scenarios/warehouse');
    expect(page.publisher['@id']).toBe('https://site.test/#org');
    expect(page.mainEntity['@type']).toBe('ItemList');
    expect(page.mainEntity.itemListElement.map((i: Node) => i.url)).toEqual(
      scenario.products.map((p) => `https://site.test/products/${p.slug}`),
    );
  });
});
