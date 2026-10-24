import { beforeAll, describe, expect, it } from 'vitest';
import { useTempDb } from './test-db';
import { getProduct } from './repo';
import { askHandler, createProductHandler, getProductHandler, listProductsHandler, updateProductHandler } from './http';
import type { ProductDetail, ProductInput } from './schema';

const json = (method: string, body: unknown) =>
  new Request('http://x/api/knowledge/products', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function toInput(p: ProductDetail): ProductInput {
  return {
    slug: p.slug, name: p.name, seriesSlug: p.series.slug, status: p.status, shortDescription: p.shortDescription,
    overview: p.overview, keyFeatures: p.features, bestFor: p.bestFor.map((b) => b.label), specs: p.specs,
  };
}

describe('knowledge http handlers', () => {
  beforeAll(() => {
    useTempDb('http');
  });

  it('404s an unknown product as problem+json', async () => {
    const res = getProductHandler('nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
  });

  it('lists products filtered by series and rejects unknown series', async () => {
    const ok = listProductsHandler(new Request('http://x/api/knowledge/products?series=nova'));
    expect(((await ok.json()) as { items: unknown[] }).items).toHaveLength(4);
    expect(listProductsHandler(new Request('http://x/api/knowledge/products?series=foo')).status).toBe(400);
  });

  it('rejects a create without name, naming the field', async () => {
    const { name: _omit, ...rest } = { ...toInput(getProduct('nova-x4')!), slug: 'brand-new' };
    const res = await createProductHandler(json('POST', rest));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { detail: string; errors: Record<string, string> };
    expect(body.detail).toMatch(/name/);
    expect(body.errors.name).toBeTruthy();
    expect(getProduct('brand-new')).toBeNull();
  });

  it('rejects a create with a duplicate slug', async () => {
    const res = await createProductHandler(json('POST', toInput(getProduct('nova-x4')!)));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { errors: Record<string, string> }).errors.slug).toMatch(/already/);
  });

  it('creates a valid product (201)', async () => {
    const res = await createProductHandler(json('POST', { ...toInput(getProduct('nova-x4')!), slug: 'nova-x10', name: 'Nova X10' }));
    expect(res.status).toBe(201);
    expect(getProduct('nova-x10')?.name).toBe('Nova X10');
  });

  it('updates key features via PUT', async () => {
    const input = { ...toInput(getProduct('nova-x4')!), keyFeatures: ['4K imaging', 'Smart IR night vision'] };
    const res = await updateProductHandler(json('PUT', input), 'nova-x4');
    expect(res.status).toBe(200);
    expect(getProduct('nova-x4')!.features).toEqual(['4K imaging', 'Smart IR night vision']);
  });

  it('404s a PUT on an unknown slug', async () => {
    const res = await updateProductHandler(json('PUT', toInput(getProduct('nova-x8')!)), 'nope');
    expect(res.status).toBe(404);
  });

  it('answers via ask handler and 400s an empty question', async () => {
    const ok = await askHandler(new Request('http://x/api/knowledge/ask', { method: 'POST', body: JSON.stringify({ question: 'Does Nova X8 support PoE?', productSlug: 'nova-x8' }) }));
    expect(((await ok.json()) as { conflict: boolean }).conflict).toBe(true);
    const bad = await askHandler(new Request('http://x/api/knowledge/ask', { method: 'POST', body: JSON.stringify({ question: '' }) }));
    expect(bad.status).toBe(400);
  });
});
