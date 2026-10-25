'use client';

import Link from 'next/link';
import { series } from '../../../design/chartTheme';
import { AsyncState, Card } from '../AsyncState';
import { OWNED_DOMAIN_DISCLAIMER, SOURCE_TYPE_NOTE, type SourceStructure } from '../types';
import { useGlobalFilter } from '../useGlobalFilter';
import { asyncProps, type SummaryApi } from './shared';

/**
 * ⑥ Sources (05 §2.7, 06 §5.7): owned share · source_type distribution · top domains. "Owned" (decided by domain)
 * and source_type (the dataset's label) never share a look: Owned = filled brand pill, type = neutral bar.
 */
export function Sources({ api }: { api: SummaryApi }) {
  const s = api.data?.sources;
  return (
    <Card title="Sources AI cites" subtitle="Which pages answers rely on · click a domain to see its questions">
      <AsyncState
        {...asyncProps(api)}
        isEmpty={!!s && s.ownedShare.totalCitations === 0}
        skeletonHeight={220}
        skeleton={
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-surface-sunken" />
            ))}
          </div>
        }
        empty={<p>No citations in this selection.</p>}
      >
        {() => <SourcesBody s={s!} />}
      </AsyncState>
    </Card>
  );
}

function SourcesBody({ s }: { s: SourceStructure }) {
  const { buildHref } = useGlobalFilter();
  const maxType = Math.max(1, ...s.byType.map((t) => t.count));
  const maxDomain = Math.max(1, ...s.topDomains.map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink-secondary">Owned source share</h3>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{s.ownedShare.shareOfCitations}%</p>
          <p className="mt-0.5 text-xs tabular-nums text-ink-tertiary">
            {s.ownedShare.owned} of {s.ownedShare.totalCitations} citations
          </p>
          {/* F9: the owned domain is an assumption — said wherever an owned metric is shown. */}
          <p className="mt-2 text-xs text-ink-tertiary">ⓘ {OWNED_DOMAIN_DISCLAIMER}</p>
          {s.ownedByPlatform.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-xs text-ink-secondary" aria-label="Owned citations by platform">
              {s.ownedByPlatform.map((p) => (
                <li key={p.platform} className="flex justify-between gap-2">
                  {p.platform}
                  <span className="tabular-nums">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink-secondary">Source type</h3>
          <ul className="mt-2 space-y-2">
            {s.byType.map((t) => (
              <li key={t.type} className="text-sm">
                <div className="flex justify-between gap-2 text-ink-secondary">
                  {t.type}
                  <span className="tabular-nums text-ink">{t.count}</span>
                </div>
                <div aria-hidden className="mt-1 h-2 rounded-full bg-surface-sunken">
                  <div className="h-2 rounded-full" style={{ width: `${(t.count / maxType) * 100}%`, backgroundColor: series.neutral }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink-secondary">Top domains</h3>
          <ul className="mt-2 space-y-1">
            {s.topDomains.map((d) => (
              <li key={d.domain}>
                <Link
                  href={buildHref('/dashboard/questions', { q: d.domain })}
                  aria-label={`${d.domain}: ${d.count} citations${d.owned ? ', owned domain' : ''}`}
                  className="focus-ring block rounded-md px-1 py-1 transition-colors duration-[120ms] ease-out hover:bg-surface-sunken"
                >
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-ink">{d.domain}</span>
                      {d.owned && (
                        <span className="shrink-0 rounded-full bg-owned-subtle px-2 py-0.5 text-xs font-medium text-owned-ink">Owned</span>
                      )}
                    </span>
                    <span className="tabular-nums text-ink">{d.count}</span>
                  </span>
                  <span aria-hidden className="mt-1 block h-2 rounded-full bg-surface-sunken">
                    <span className={`block h-2 rounded-full ${d.owned ? 'bg-owned' : 'bg-ink-tertiary'}`} style={{ width: `${(d.count / maxDomain) * 100}%` }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="border-t border-line pt-3 text-xs text-ink-tertiary">{SOURCE_TYPE_NOTE}</p>
    </div>
  );
}
