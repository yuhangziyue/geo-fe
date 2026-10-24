import { getProduct, listProducts } from './repo';
import type { ProductDetail } from './schema';

export type AskResult = {
  found: boolean;
  answer: string;
  conflict: boolean;
  sources: Array<{ label: string; href: string }>;
};

const STOP = new Set(
  'a an and are be can could do does for from has have how i in is it its me my of on or our the this to what when where which who why will with you your product products camera cameras support supports supported include includes offer offers'.split(' '),
);

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9+\-]+/).map((w) => w.replace(/^-+|-+$/g, '')).filter(Boolean);
}
const contentTokens = (s: string) => tokens(s).filter((w) => !STOP.has(w));
const singular = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

// Every target token must appear as a token of the haystack ("wi-fi 7" does not match "Wi-Fi + Ethernet").
function matches(hay: string | null, target: string[]): boolean {
  if (!hay || target.length === 0) return false;
  const set = new Set(tokens(hay));
  return target.every((t) => set.has(t));
}

// Feature terms that the specs also describe; used to detect features-vs-specs disagreement.
const SPEC_TERMS: Array<{ terms: string[]; field: 'connectivity' | 'environment'; ok: (v: string) => boolean }> = [
  { terms: ['poe', 'ethernet', 'wi-fi', 'wifi'], field: 'connectivity', ok: () => false },
  { terms: ['ip67', 'ip66', 'outdoor', 'weatherproof'], field: 'environment', ok: (v) => /outdoor/i.test(v) },
];

const href = (p: ProductDetail, anchor: string) => `/products/${p.slug}#${anchor}`;

type Hit = { product: ProductDetail; answer: string; conflict: boolean; sources: AskResult['sources'] };

function checkSupport(p: ProductDetail, targetText: string, target: string[]): Hit | null {
  const featuresSrc = { label: `${p.name} · Features`, href: href(p, 'features') };
  const specsSrc = { label: `${p.name} · Specs`, href: href(p, 'specs') };
  const ai = p.specs.aiFeatures.find((f) => matches(f, target));
  if (ai) return { product: p, answer: `Yes. ${p.name} lists "${ai}" among its AI features.`, conflict: false, sources: [specsSrc] };

  const specFields = (['connectivity', 'environment', 'resolution'] as const).filter((k) => matches(p.specs[k], target));
  const feat = p.features.find((f) => matches(f, target));
  if (specFields.length) {
    const facts = specFields.map((k) => `${k} "${p.specs[k]}"`).join(', ');
    return { product: p, answer: `Yes. ${p.name} specs list ${facts}.`, conflict: false, sources: feat ? [featuresSrc, specsSrc] : [specsSrc] };
  }
  if (feat) {
    const rule = SPEC_TERMS.find((r) => r.terms.some((t) => target.includes(t)));
    if (rule && !rule.ok(p.specs[rule.field])) {
      return {
        product: p,
        answer: `Sources disagree. ${p.name}'s Features list "${feat}", but its Specs list ${rule.field} as "${p.specs[rule.field]}". Please confirm with AsterVision before relying on this.`,
        conflict: true,
        sources: [featuresSrc, specsSrc],
      };
    }
    return { product: p, answer: `${p.name} lists "${feat}" as a key feature.`, conflict: false, sources: [featuresSrc] };
  }
  // "AI event detection"-style questions: answer from the AI feature specs, not the template FAQ.
  if (target.includes('ai') && p.specs.aiFeatures.length) {
    return { product: p, answer: `${p.name} lists these AI features: ${p.specs.aiFeatures.join(', ')}.`, conflict: false, sources: [specsSrc] };
  }
  return null;
}

function scope(question: string, productSlug?: string): { products: ProductDetail[]; named: boolean } {
  if (productSlug) {
    const p = getProduct(productSlug);
    return { products: p ? [p] : [], named: true };
  }
  const all = listProducts({}).map((s) => getProduct(s.slug)!).filter(Boolean);
  const q = question.toLowerCase();
  const named = all.filter((p) => q.includes(p.name.toLowerCase()));
  return named.length ? { products: named, named: true } : { products: all, named: false };
}

const NOT_FOUND = (where: string, what: string): AskResult => ({
  found: false,
  conflict: false,
  sources: [],
  answer: `The knowledge base has no information about ${what} for ${where}. Try rephrasing, or check the product specs.`,
});

export function ask(question: string, productSlug?: string): AskResult {
  const q = question.trim();
  const { products, named } = scope(q, productSlug);
  if (products.length === 0) return NOT_FOUND('this product', 'that');
  const where = named && products.length === 1 ? products[0].name : 'any product';

  // "best for / suited for <scenario>": answer from Best For labels ("warehouses" matches "Warehouse").
  const bestFor = q.match(/\b(?:best|suited|suitable|recommended|good)\s+for\s+(.+?)[?.!]*$/i);
  const wanted = bestFor ? contentTokens(bestFor[1]).map(singular) : [];
  if (wanted.length) {
    const hits = products
      .map((p) => ({ p, label: p.bestFor.find((b) => contentTokens(b.label).map(singular).every((t) => wanted.includes(t)))?.label }))
      .filter((h): h is { p: ProductDetail; label: string } => Boolean(h.label));
    if (hits.length === 0) return NOT_FOUND(where, `"${bestFor![1]}"`);
    return {
      found: true,
      conflict: false,
      answer: `${hits.length} product${hits.length > 1 ? 's' : ''} list "${hits[0].label}" under Best For: ${hits.map((h) => h.p.name).join(', ')}.`,
      sources: hits.slice(0, 8).map((h) => ({ label: `${h.p.name} · Best For`, href: href(h.p, 'best-for') })),
    };
  }

  const support = q.match(/\b(?:support|supports|have|has|include|includes|offer|offers|come with)\s+(.+?)[?.!]*$/i);
  if (support) {
    const targetText = support[1].replace(/^(a|an|the)\s+/i, '');
    const target = contentTokens(targetText);
    const hits = products.map((p) => checkSupport(p, targetText, target)).filter((h): h is Hit => h !== null);
    if (hits.length === 0) return NOT_FOUND(where, `"${targetText}"`);
    if (named && hits.length === 1) {
      const h = hits[0];
      return { found: true, answer: h.answer, conflict: h.conflict, sources: h.sources };
    }
    const conflicts = hits.filter((h) => h.conflict);
    const names = hits.map((h) => h.product.name).join(', ');
    const answer =
      `${hits.length} product${hits.length > 1 ? 's' : ''} mention "${targetText}": ${names}.` +
      (conflicts.length ? ` Sources disagree for ${conflicts.map((h) => h.product.name).join(', ')} (Features vs Specs).` : '');
    return { found: true, answer, conflict: conflicts.length > 0, sources: hits.slice(0, 8).flatMap((h) => h.sources.slice(-1)) };
  }

  // General question: keyword overlap against FAQ questions.
  const qt = contentTokens(q);
  let best: { score: number; p: ProductDetail; f: ProductDetail['faqs'][number] } | null = null;
  for (const p of products) {
    for (const f of p.faqs) {
      const ft = new Set(contentTokens(f.question));
      const score = qt.length ? qt.filter((w) => ft.has(w)).length / qt.length : 0;
      if (!best || score > best.score) best = { score, p, f };
    }
  }
  if (!best || best.score < 0.6) return NOT_FOUND(where, 'that');
  return {
    found: true,
    conflict: false,
    answer: best.f.answer,
    sources: [{ label: `${best.p.name} · FAQ #${best.f.position}`, href: href(best.p, `faq-${best.f.position}`) }],
  };
}
