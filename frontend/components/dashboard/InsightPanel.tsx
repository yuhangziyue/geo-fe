'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AsyncState, Card } from './AsyncState';
import type { Insight } from './types';
import { fetchJson, withSimulate } from './useApi';

type State = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; insights: Insight[] };

/** Rule-based "AI Insight": generated on demand, every point links to its evidence. */
export function InsightPanel({ platform, simulate }: { platform: string; simulate: string | null }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  const run = async () => {
    setState({ status: 'loading' });
    try {
      const body = await fetchJson<{ insights: Insight[] }>(withSimulate('/api/dashboard/insight', simulate), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(platform ? { platform } : {}),
      });
      setState({ status: 'ok', insights: body.insights });
    } catch (e) {
      setState({ status: 'error', error: (e as Error).message });
    }
  };

  return (
    <Card
      title="AI Insight"
      subtitle="Rule-based findings computed from the question data — each links to its evidence"
      action={
        <button
          type="button"
          onClick={run}
          disabled={state.status === 'loading'}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {state.status === 'idle' ? 'Generate insights' : state.status === 'loading' ? 'Analyzing…' : 'Regenerate'}
        </button>
      }
    >
      {state.status === 'idle' ? (
        <p className="text-sm text-slate-500">Click “Generate insights” to analyze the current selection.</p>
      ) : (
        <AsyncState
          status={state.status}
          error={state.status === 'error' ? state.error : null}
          onRetry={run}
          isEmpty={state.status === 'ok' && state.insights.length === 0}
          empty={<p>Not enough data to derive insights for this selection.</p>}
          skeletonHeight={100}
        >
          {() => (
            <ol className="grid gap-3 md:grid-cols-2">
              {state.status === 'ok' &&
                state.insights.map((i, n) => (
                  <li key={i.id} className="rounded-lg border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {n + 1}. {i.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{i.detail}</p>
                    <Link href={i.evidenceHref} className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
                      View evidence →
                    </Link>
                  </li>
                ))}
            </ol>
          )}
        </AsyncState>
      )}
    </Card>
  );
}
