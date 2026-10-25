'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { GlobalFilter, LlmSummaryResult, SummaryRequest } from '../types';
import { fetchJson, withSimulate } from '../useApi';

export type SummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ok'; result: LlmSummaryResult };

/**
 * The Generate button's request: POST /api/dashboard/action-center/summary {mode:'ai', ...filter}. The backend
 * always answers with a valid summary and falls back to the rule template itself, so the button never needs a key.
 */
export function useLlmSummary(filter: GlobalFilter, simulate: string | null) {
  const [state, setState] = useState<SummaryState>({ status: 'idle' });
  const run = useRef(0);
  useEffect(() => () => void (run.current += 1), []);

  const generate = useCallback(async () => {
    const id = ++run.current;
    setState({ status: 'loading' });
    const body: SummaryRequest = { mode: 'ai', ...filter };
    try {
      const result = await fetchJson<LlmSummaryResult>(withSimulate('/api/dashboard/action-center/summary', simulate), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (id === run.current) setState({ status: 'ok', result });
    } catch (e) {
      if (id === run.current) setState({ status: 'error', error: (e as Error).message });
    }
  }, [filter, simulate]);

  return { state, generate };
}

const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';

/** Mode badge, decided from `mode` alone (never from the model id): Rules · AI summary · <model> · Mock LLM (demo). */
export function SummaryBadges({ state }: { state: SummaryState }) {
  const r = state.status === 'ok' ? state.result : null;
  let badge: ReactNode = <span className={`${pill} border border-line-strong text-ink-secondary`}>Rules</span>;
  if (r?.mode === 'ai') badge = <span className={`${pill} bg-brand-subtle text-brand-ink`}>AI summary · {r.model ?? 'Claude'}</span>;
  if (r?.mode === 'mock') badge = <span className={`${pill} bg-warning-subtle text-warning-ink`}>Mock LLM (demo)</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" aria-live="polite">
      {badge}
      {r?.verification.band === 'low' && <span className={`${pill} bg-danger-subtle text-danger`}>low-verification</span>}
    </span>
  );
}

/** Always available — with or without an API key (05 §2 ruling); disabled only while a request is in flight. */
export function GenerateButton({ state, onClick }: { state: SummaryState; onClick: () => void }) {
  const loading = state.status === 'loading';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface-card px-3 text-sm font-medium text-ink transition-colors duration-[120ms] ease-out hover:bg-surface-sunken disabled:cursor-wait disabled:text-ink-disabled"
    >
      {loading && <span aria-hidden className="h-3 w-3 rounded-full border-2 border-line-strong border-t-brand motion-safe:animate-spin" />}
      {loading ? 'Writing summary…' : state.status === 'idle' ? 'Generate summary' : 'Regenerate summary'}
    </button>
  );
}

/**
 * The summary block above the cards (06 §5.8): `surface-sunken`, ≤ 72ch. Every unverified number is marked in
 * place from its [start, end) offsets — red text on `danger-subtle`, dashed underline, focusable, described as
 * "Not found in source data". The footer states the verification band; a fallback's reason is the template text's first line.
 */
export function LlmSummary({ state, onRetry }: { state: SummaryState; onRetry: () => void }) {
  const noteId = useId();
  if (state.status === 'idle') return null;
  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="Writing summary" className="space-y-2 rounded-xl bg-surface-sunken p-4 motion-safe:animate-pulse">
        <div className="h-4 w-11/12 rounded-md bg-line" />
        <div className="h-4 w-10/12 rounded-md bg-line" />
        <div className="h-4 w-7/12 rounded-md bg-line" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <p className="text-sm text-ink-secondary">
        Summary unavailable ({state.error}) — showing rule-based findings.{' '}
        <button type="button" onClick={onRetry} className="focus-ring rounded-md font-medium text-brand hover:text-brand-hover hover:underline">
          Try again
        </button>
      </p>
    );
  }

  const r = state.result;
  const v = r.verification;
  return (
    <div className="space-y-2 rounded-xl bg-surface-sunken p-4">
      <p className="max-w-[72ch] whitespace-pre-line text-sm leading-6 text-ink">{markUnverified(r, noteId)}</p>
      <span id={noteId} className="sr-only">Not found in source data</span>
      <div className="space-y-0.5 text-xs">
        {/* A fallback's reason is the template's own first line (controller ruling, B2); not repeated here. */}
        <VerificationLine v={v} />
      </div>
    </div>
  );
}

function VerificationLine({ v }: { v: LlmSummaryResult['verification'] }) {
  if (v.total === 0) return <p className="text-ink-tertiary">No numbers in this summary to verify.</p>;
  if (v.band === 'all') return <p className="text-positive">✓ {v.verified}/{v.total} numbers verified against source data</p>;
  if (v.band === 'low') return <p className="text-danger">{v.verified}/{v.total} numbers verified — treat this summary with caution</p>;
  return (
    <p className="text-warning">
      {v.verified}/{v.total} numbers verified — {v.total - v.verified} highlighted
    </p>
  );
}

/** Splits the text at every unverified number's [start, end); offsets outside the text or overlapping are skipped. */
function markUnverified(r: LlmSummaryResult, noteId: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  const marks = r.numbers.filter((n) => !n.verified).sort((a, b) => a.start - b.start);
  for (const n of marks) {
    if (n.start < at || n.end > r.text.length || n.end <= n.start) continue;
    if (n.start > at) out.push(r.text.slice(at, n.start));
    out.push(
      <span
        key={n.start}
        tabIndex={0}
        title="Not found in source data"
        aria-describedby={noteId}
        className="focus-ring rounded-md bg-danger-subtle px-0.5 text-danger underline decoration-danger decoration-dashed decoration-1 underline-offset-2"
      >
        {r.text.slice(n.start, n.end)}
      </span>,
    );
    at = n.end;
  }
  if (at < r.text.length) out.push(r.text.slice(at));
  return out;
}
