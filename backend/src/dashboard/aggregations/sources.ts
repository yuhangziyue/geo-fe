import { isOwnedUrl } from '../insight';
import { pct } from '../metrics';
import { PLATFORMS, type Platform, type Question, type SourceStructure } from '../schema';

export const TOP_DOMAINS_LIMIT = 8;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * Source structure (05 §2.7). `source_type` is the dataset label; "owned" is decided by domain only (F4).
 * Ties: byType and topDomains by name asc, ownedByPlatform in PLATFORMS order.
 */
export function sourceStructure(rows: Question[]): SourceStructure {
  const citations = rows.flatMap((q) => q.citations.map((c) => ({ ...c, platform: q.platform })));
  const types = new Map<string, number>();
  const domains = new Map<string, number>();
  const ownedBy = new Map<Platform, number>();
  let owned = 0;
  for (const c of citations) {
    types.set(c.source_type, (types.get(c.source_type) ?? 0) + 1);
    const host = hostOf(c.url);
    domains.set(host, (domains.get(host) ?? 0) + 1);
    if (isOwnedUrl(c.url)) {
      owned += 1;
      ownedBy.set(c.platform, (ownedBy.get(c.platform) ?? 0) + 1);
    }
  }
  const byName = <T extends { count: number }>(name: (x: T) => string) => (a: T, b: T) =>
    b.count - a.count || (name(a) < name(b) ? -1 : name(a) > name(b) ? 1 : 0);

  return {
    byType: [...types.entries()].map(([type, count]) => ({ type, count })).sort(byName((x) => x.type)),
    topDomains: [...domains.entries()]
      .map(([domain, count]) => ({ domain, count, owned: isOwnedUrl(`https://${domain}`) }))
      .sort(byName((x) => x.domain))
      .slice(0, TOP_DOMAINS_LIMIT),
    ownedShare: { owned, totalCitations: citations.length, shareOfCitations: pct(owned, citations.length) },
    ownedByPlatform: [...ownedBy.entries()]
      .sort((a, b) => b[1] - a[1] || PLATFORMS.indexOf(a[0]) - PLATFORMS.indexOf(b[0]))
      .map(([platform, count]) => ({ platform, count })),
  };
}
