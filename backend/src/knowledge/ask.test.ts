import { beforeAll, describe, expect, it } from 'vitest';
import { useTempDb } from './test-db';
import { ask } from './ask';

describe('ask', () => {
  beforeAll(() => {
    useTempDb('ask');
  });

  it('flags a features-vs-specs conflict and cites both', () => {
    const r = ask('Does Nova X8 support PoE?', 'nova-x8');
    expect(r.conflict).toBe(true);
    expect(r.sources).toHaveLength(2);
    expect(r.sources.map((s) => s.label).join(' ')).toMatch(/Features/);
    expect(r.sources.map((s) => s.label).join(' ')).toMatch(/Specs/);
  });

  it('answers support questions from the AI feature specs', () => {
    const r = ask('Does Nova X4 support line crossing?', 'nova-x4');
    expect(r.found).toBe(true);
    expect(r.conflict).toBe(false);
    expect(r.answer).toContain('Line crossing');
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].label).toMatch(/Specs/);
    expect(r.sources[0].href).toBe('/products/nova-x4#specs');
  });

  it('says not found instead of guessing', () => {
    const r = ask('Does Nova X4 support Wi-Fi 7?', 'nova-x4');
    expect(r.found).toBe(false);
    expect(r.sources).toHaveLength(0);
  });

  it('falls back to FAQ retrieval with a source link', () => {
    const r = ask('What scenarios is Nova X4 best suited for?');
    expect(r.found).toBe(true);
    expect(r.sources[0].href).toBe('/products/nova-x4#faq-1');
  });

  it('answers across all products when no product is given', () => {
    const r = ask('Which products support intrusion detection?');
    expect(r.found).toBe(true);
    expect(r.answer).toContain('Nova X8');
  });

  it('answers "best for <scenario>" from Best For, plural or singular (list-page example)', () => {
    for (const q of ['Which products are best for warehouses?', 'Which products are best for warehouse?']) {
      const r = ask(q);
      expect(r.found).toBe(true);
      expect(r.answer).toContain('Nova X4');
      expect(r.sources.every((s) => s.href.endsWith('#best-for'))).toBe(true);
    }
  });

  it('says not found for a Best For value no product lists', () => {
    expect(ask('Which products are best for hospitals?').found).toBe(false);
  });
});
