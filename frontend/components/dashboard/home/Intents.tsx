'use client';

import Link from 'next/link';
import { series } from '../../../design/chartTheme';
import { AsyncState, Card } from '../AsyncState';
import { INTENT_TIERS_DISCLAIMER, type IntentRow } from '../types';
import { useGlobalFilter } from '../useGlobalFilter';
import { InfoTip } from './InfoTip';
import { INTENT_BADGE_CLASS } from './Matrix';
import { asyncProps, ClearFilters, type SummaryApi } from './shared';

/**
 * ⑤-right Intent tiers (05 §2.6, 06 §5.5): four columns C → B → A → S in the backend's order
 * (INTENT_DISPLAY_ORDER). An empty tier is a hatched "Not tracked" placeholder — never a 0% bar.
 * Replaces e2's IntentCards.
 */
export function Intents({ api }: { api: SummaryApi }) {
  const intents = api.data?.intents;
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-1">
          Intent tiers <InfoTip text={INTENT_TIERS_DISCLAIMER} />
        </span>
      }
      subtitle="Awareness → decision · click a tier to see its questions"
    >
      <AsyncState
        {...asyncProps(api)}
        isEmpty={!!intents && intents.every((t) => t.isEmpty)}
        skeletonHeight={180}
        skeleton={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-surface-sunken" />
            ))}
          </div>
        }
        empty={
          <>
            <p>No questions match these filters.</p>
            <ClearFilters />
          </>
        }
      >
        {() => (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {intents!.map((t) => (
              <li key={t.tier} className="min-w-0">
                {t.isEmpty ? <EmptyTier t={t} /> : <Tier t={t} />}
              </li>
            ))}
          </ul>
        )}
      </AsyncState>
    </Card>
  );
}

function TierHead({ t }: { t: IntentRow }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-semibold ${INTENT_BADGE_CLASS[t.tier]}`}>
        {t.tier}
      </span>
      <span className="truncate text-sm font-medium text-ink">{t.label}</span>
    </span>
  );
}

function Tier({ t }: { t: IntentRow }) {
  const { buildHref } = useGlobalFilter();
  return (
    <Link
      href={buildHref('/dashboard/questions', { intent: t.tier })}
      aria-label={`Intent ${t.tier} ${t.label}: ${t.questions} questions, visibility ${t.visibility}%, recommendation rate ${t.recommendationRateOfAsked}%`}
      className="focus-ring block h-full rounded-xl border border-line p-3 transition-colors duration-[120ms] ease-out hover:bg-surface-sunken"
    >
      <TierHead t={t} />
      <span className="mt-1 block text-xs tabular-nums text-ink-tertiary">n={t.questions}</span>
      <Bar label="Mentioned" pct={t.visibility} color={series.visibility} />
      <Bar label="Recommended" pct={t.recommendationRateOfAsked} color={series.recommendation} />
    </Link>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <span className="mt-3 block">
      <span className="flex items-baseline justify-between gap-2 text-xs text-ink-secondary">
        {label}
        <span className="text-base font-semibold tabular-nums text-ink">{pct}%</span>
      </span>
      <span aria-hidden className="mt-1 block h-1.5 w-full rounded-full bg-surface-sunken">
        <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }} />
      </span>
    </span>
  );
}

/** "Not tracked" uses the matrix's hatch: one vocabulary for "never asked" across the page (06 §2). */
function EmptyTier({ t }: { t: IntentRow }) {
  return (
    <div className="cov-untracked flex h-full min-h-40 flex-col rounded-xl border border-dashed border-line-strong p-3">
      <TierHead t={t} />
      <p className="mt-3 text-xs leading-5 text-ink-secondary">
        Not tracked — no {t.tier === 'S' ? 'decision-stage' : `${t.label.toLowerCase()}-stage`} questions in this {t.tier === 'S' ? 'dataset' : 'selection'}
      </p>
    </div>
  );
}
