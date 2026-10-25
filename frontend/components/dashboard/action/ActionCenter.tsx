'use client';

import { useSearchParams } from 'next/navigation';
import { AsyncState, Card } from '../AsyncState';
import type { ActionCardsResponse, GlobalFilter } from '../types';
import { useApi, type ApiState } from '../useApi';
import { useGlobalFilter } from '../useGlobalFilter';
import { ActionCard } from './ActionCard';
import { GenerateButton, LlmSummary, SummaryBadges, useLlmSummary } from './LlmSummary';

type CardsApi = ApiState<ActionCardsResponse> & { retry: () => void };

/**
 * ④ Action Center (05 §3, 06 §5.8; 4th on the page, right after the matrix). The rule cards load with the page
 * (GET /api/dashboard/action-center/cards with the current filter); the Generate button is always available and
 * only adds the executive summary above them.
 */
export function ActionCenter() {
  const { filter, buildHref } = useGlobalFilter();
  const simulate = useSearchParams().get('simulate');
  const cards = useApi<ActionCardsResponse>(buildHref('/api/dashboard/action-center/cards'));
  // Keyed by the selection: a summary written for another filter must not linger next to these cards.
  const key = `${filter.platform ?? ''}|${filter.topic ?? ''}|${filter.intent ?? ''}|${simulate ?? ''}`;
  return <ActionCenterBody key={key} cards={cards} filter={filter} simulate={simulate} />;
}

function ActionCenterBody({ cards, filter, simulate }: { cards: CardsApi; filter: GlobalFilter; simulate: string | null }) {
  const { state, generate } = useLlmSummary(filter, simulate);
  return (
    <Card
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Action Center <SummaryBadges state={state} />
        </span>
      }
      subtitle="What to fix next, from rule-based findings · each card links to its evidence"
      action={<GenerateButton state={state} onClick={generate} />}
    >
      <div className="space-y-4">
        <LlmSummary state={state} onRetry={generate} />
        <AsyncState
          status={cards.status}
          error={cards.error}
          refreshing={cards.refreshing}
          onRetry={cards.retry}
          isEmpty={!!cards.data && cards.data.cards.length === 0}
          skeletonHeight={200}
          skeleton={
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-48 rounded-xl bg-surface-sunken" />
              ))}
            </div>
          }
          empty={<p>No issues crossed a threshold for this selection.</p>}
        >
          {() => (
            <ol className="grid gap-4 md:grid-cols-2" aria-label="Action cards, most severe first">
              {cards.data!.cards.map((c) => (
                <li key={c.id} className="flex">
                  <ActionCard card={c} />
                </li>
              ))}
            </ol>
          )}
        </AsyncState>
      </div>
    </Card>
  );
}
