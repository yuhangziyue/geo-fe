'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { series } from '../../../design/chartTheme';
import { AsyncState } from '../AsyncState';
import { OWNED_DOMAIN_DISCLAIMER, type FunnelKpi } from '../types';
import { useGlobalFilter } from '../useGlobalFilter';
import { InfoTip } from '../shared/InfoTip';
import { asyncProps, ClearFilters, Delta, type SummaryApi } from './shared';

/**
 * ② Funnel KPI band (05 §2.2, 06 §5.1): ONE card, three nested steps Asked → Mentioned → Recommended joined by
 * conversion connectors, plus the two non-nested side metrics (F6). Every number comes from `summary.funnel`.
 * Replaces e2's KpiRow.
 */
export function Funnel({ api }: { api: SummaryApi }) {
  const f = api.data?.funnel;
  return (
    <section aria-label="Funnel" className="rounded-xl border border-line bg-surface-card p-5">
      <AsyncState
        {...asyncProps(api)}
        isEmpty={!!f && f.questions.value === 0}
        skeletonHeight={112}
        skeleton={<FunnelSkeleton />}
        empty={
          <>
            <p>No questions match these filters.</p>
            <ClearFilters />
          </>
        }
      >
        {() => <FunnelBand f={f!} />}
      </AsyncState>
    </section>
  );
}

function FunnelBand({ f }: { f: FunnelKpi }) {
  const { buildHref } = useGlobalFilter();
  const asked = f.questions.value;
  const dropped = asked - f.mentions.value;
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch">
        <Step
          href={buildHref('/dashboard/questions')}
          label="Asked"
          tip="Questions analyzed in this selection (one row = one run of a prompt on one platform)."
          value={asked}
          sub="questions asked"
          bar={{ pct: 100, className: 'bg-line-strong' }}
        />
        <Connector rate={f.mentions.rateOfPrevious} />
        <Step
          href={buildHref('/dashboard/questions', { mentioned: 'true' })}
          label="Mentioned"
          tip="Visibility = questions whose answer mentions the brand ÷ questions asked."
          value={f.mentions.value}
          sub={`${f.mentions.rateOfAsked}% of asked`}
          delta={<Delta pt={f.mentions.deltaPt} />}
          bar={{ pct: f.mentions.rateOfAsked, color: series.visibility }}
          after={
            dropped > 0 ? (
              <Link
                href={buildHref('/dashboard/questions', { mentioned: 'false' })}
                className="focus-ring mt-1 inline-block rounded-md text-xs text-ink-secondary hover:text-ink hover:underline"
              >
                <span className="tabular-nums">{dropped}</span> not mentioned →
              </Link>
            ) : null
          }
        />
        <Connector rate={f.recommendations.rateOfPrevious} />
        <Step
          href={buildHref('/dashboard/questions', { recommended: 'true' })}
          label="Recommended"
          tip="Recommendation rate = questions whose answer recommends the brand ÷ questions asked. The connector shows recommended ÷ mentioned."
          value={f.recommendations.value}
          sub={`${f.recommendations.rateOfAsked}% of asked · ${f.recommendations.rateOfPrevious}% of mentioned`}
          delta={<Delta pt={f.recommendations.deltaPt} />}
          bar={{ pct: f.recommendations.rateOfAsked, color: series.recommendation }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 xl:w-96 xl:shrink-0 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <Side
          label="Source-backed"
          tip="Questions whose answer cites at least one source ÷ questions that mention the brand. Not part of the funnel: a citation does not imply a recommendation."
          value={`${f.sourceBacked.rateOfMentioned}%`}
          sub={`${f.sourceBacked.cited} of ${f.mentions.value} mentioned`}
          delta={<Delta pt={f.sourceBacked.deltaPt} />}
        />
        <Side
          label="Owned source share"
          tip={OWNED_DOMAIN_DISCLAIMER}
          tipAlign="right"
          value={`${f.ownedSource.shareOfCitations}%`}
          sub={`${f.ownedSource.owned} of ${f.ownedSource.totalCitations} citations`}
          delta={<Delta pt={f.ownedSource.deltaPt} />}
        />
      </div>
    </div>
  );
}

function Step(props: {
  href: string;
  label: string;
  tip: string;
  value: number;
  sub: string;
  delta?: ReactNode;
  bar: { pct: number; className?: string; color?: string };
  after?: ReactNode;
}) {
  const { href, label, tip, value, sub, delta, bar, after } = props;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1 px-3 pt-2 text-sm font-medium text-ink-secondary">
        {label}
        <InfoTip text={tip} />
      </div>
      {/* The whole step is the link (06 §5.1 hover); the ⓘ sits outside it so focus never nests. */}
      <Link
        href={href}
        className="focus-ring block rounded-md px-3 pb-2 transition-colors duration-[120ms] ease-out hover:bg-surface-sunken"
      >
        <span className="sr-only">{label}: </span>
        <span className="block text-3xl font-semibold tabular-nums text-ink">{value}</span>
        <span className="mt-0.5 block text-xs text-ink-tertiary tabular-nums">{sub}</span>
        <span className="mt-1 block min-h-4">{delta}</span>
        <span className="mt-2 block h-1 w-full rounded-full bg-surface-sunken" aria-hidden>
          <span
            className={`block h-1 rounded-full ${bar.className ?? ''}`}
            style={{ width: `${Math.max(0, Math.min(100, bar.pct))}%`, backgroundColor: bar.color }}
          />
        </span>
      </Link>
      {after && <div className="px-3">{after}</div>}
    </div>
  );
}

/** `→ 66%` between steps (`↓ 66%` when the steps stack at 375). */
function Connector({ rate }: { rate: number }) {
  return (
    <div className="flex items-center justify-center px-1 py-1 text-xs tabular-nums text-ink-tertiary md:py-0">
      <span className="sr-only">{rate}% continue to the next step</span>
      <span aria-hidden className="md:hidden">↓ {rate}%</span>
      <span aria-hidden className="hidden md:inline">→ {rate}%</span>
    </div>
  );
}

function Side(props: { label: string; tip: string; tipAlign?: 'left' | 'right'; value: string; sub: string; delta: ReactNode }) {
  const { label, tip, tipAlign, value, sub, delta } = props;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-sm font-medium text-ink-secondary">
        {label}
        <InfoTip text={tip} align={tipAlign} />
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-tertiary tabular-nums">{sub}</p>
      <p className="mt-1">{delta}</p>
    </div>
  );
}

function FunnelSkeleton() {
  return (
    <div className="flex flex-col gap-5 xl:flex-row">
      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 space-y-2 px-3 py-2">
            <div className="h-4 w-20 rounded-md bg-surface-sunken" />
            <div className="h-8 w-16 rounded-md bg-surface-sunken" />
            <div className="h-3 w-24 rounded-md bg-surface-sunken" />
            <div className="h-1 w-full rounded-full bg-surface-sunken" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 xl:w-96">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded-md bg-surface-sunken" />
            <div className="h-6 w-12 rounded-md bg-surface-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}
