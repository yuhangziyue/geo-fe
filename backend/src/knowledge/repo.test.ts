import { beforeAll, describe, expect, it } from 'vitest';
import { useTempDb } from './test-db';
import { getProduct, getScenario, listProducts, listScenarios, listSeries, countAll, getBrand } from './repo';

describe('knowledge repo', () => {
  beforeAll(() => {
    useTempDb('repo');
  });

  it('seeds the row counts from the JSON files', () => {
    expect(countAll()).toEqual({ products: 20, series: 5, faqs: 40, scenarios: 8 });
  });

  it('filters products by series', () => {
    expect(listProducts({ series: 'nova' })).toHaveLength(4);
    expect(listProducts({})).toHaveLength(20);
    expect(listSeries()).toHaveLength(5);
  });

  it('includes key features in list items (exam: list shows Key Features)', () => {
    const [first] = listProducts({ series: 'nova' });
    expect(first.features).toHaveLength(4);
    expect(first.features).toEqual(getProduct(first.slug)!.features);
  });

  it('returns a scenario with the products whose best_for names it exactly', () => {
    const warehouse = getScenario('warehouse')!;
    expect(warehouse.name).toBe('Warehouse');
    expect(warehouse.products.length).toBeGreaterThan(0);
    for (const p of warehouse.products) {
      expect(getProduct(p.slug)!.bestFor.map((b) => b.label)).toContain('Warehouse');
    }
    // No product's best_for is literally "Multi-site" (Edge says "Multi-site Deployment"), see 03 §3.3.
    expect(getScenario('multi-site')!.products).toEqual([]);
    expect(getScenario('nope')).toBeNull();
    expect(listScenarios()).toHaveLength(8);
  });

  it('links best_for labels to scenarios only on exact name match', () => {
    const p = getProduct('nova-x4')!;
    expect(p.bestFor.find((b) => b.label === 'Warehouse')?.scenarioSlug).toBe('warehouse');
    const t = getProduct('thermal-t2')!;
    expect(t.bestFor.find((b) => b.label === 'Critical Infrastructure')?.scenarioSlug).toBeNull();
  });

  it('returns null for unknown slugs', () => {
    expect(getProduct('nope')).toBeNull();
  });

  it('keeps Edge resolution as null', () => {
    expect(getProduct('edge-box-e1')!.specs.resolution).toBeNull();
  });

  it('loads features, ai features, faqs and siblings', () => {
    const p = getProduct('nova-x4')!;
    expect(p.features).toEqual(['4K imaging', 'Low-light color imaging', 'Edge event detection', 'PoE support']);
    expect(p.specs.aiFeatures).toContain('Line crossing');
    expect(p.faqs).toHaveLength(2);
    expect(p.seriesSiblings.map((s) => s.slug)).not.toContain('nova-x4');
    expect(p.seriesSiblings).toHaveLength(3);
    expect(getBrand().name).toBe('AsterVision');
  });
});
