'use client';

import { useSyncExternalStore } from 'react';
import type { Platform, Summary } from '../types';
import type { ApiState } from '../useApi';
import { useGlobalFilter } from '../useGlobalFilter';

/** The one summary request of the home page, handed to every block that renders from it. */
export type SummaryApi = ApiState<Summary> & { retry: () => void };

/** AsyncState props shared by every block that renders from the summary request. */
export function asyncProps(api: SummaryApi) {
  return { status: api.status, error: api.error, refreshing: api.refreshing, onRetry: api.retry };
}

/** 06 §7 column-header abbreviations for the matrix below xl (52px columns cannot fit the names) (full names stay in title / aria-label). */
export const PLATFORM_ABBR: Record<Platform, string> = {
  ChatGPT: 'GPT',
  Gemini: 'GEM',
  Claude: 'CLA',
  Perplexity: 'PPX',
  DeepSeek: 'DSK',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08-07" → "Aug 7" (string slicing: no timezone can shift the day). */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1] ?? m} ${Number(d)}`;
}

/** "2026-08-01~2026-08-30" → "Aug 1 – Aug 30". */
export function formatPeriod(period: string): string {
  const [from, to] = period.split('~');
  return from && to ? `${formatDay(from)} – ${formatDay(to)}` : period;
}

/**
 * `▲ 4 pt` / `▼ 12 pt` / `0 pt` vs first 15 days; null → `Too few samples` (05 §1, 06 §5.1).
 * Colour never carries the meaning alone: the arrow and "pt" do.
 */
export function Delta({ pt, suffix = 'vs first 15 days' }: { pt: number | null; suffix?: string }) {
  if (pt === null) return <span className="text-xs text-delta-flat">Too few samples</span>;
  if (pt === 0) return <span className="text-xs text-delta-flat tabular-nums">0 pt {suffix}</span>;
  const down = pt < 0;
  return (
    <span className={`text-xs tabular-nums ${down ? 'text-delta-down' : 'text-delta-up'}`}>
      <span aria-hidden>{down ? '▼' : '▲'}</span>
      <span className="sr-only">{down ? 'down' : 'up'}</span> {Math.abs(pt)} pt {suffix}
    </span>
  );
}

/** The empty state's one action. */
export function ClearFilters() {
  const { reset } = useGlobalFilter();
  return (
    <button type="button" onClick={reset} className="focus-ring rounded-md text-sm font-medium text-brand hover:text-brand-hover hover:underline">
      Clear filters
    </button>
  );
}

const NARROW = '(max-width: 639px)';

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** < 640px (06 §7: horizontal platform bars, legend on top, weekly x labels). False on the server. */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
