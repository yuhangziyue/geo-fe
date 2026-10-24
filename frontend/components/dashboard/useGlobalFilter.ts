'use client';

import { globalFilterHref, GLOBAL_FILTER_KEYS, parseGlobalFilter } from '@geo/backend/dashboard/schema';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { GlobalFilter } from './types';

/** URL keys that are not filters but travel with every dashboard link (05 §2.1: simulate is passed through). */
const PASS_THROUGH = ['simulate'] as const;

/**
 * The dashboard's global filter (platform / topic / intent), stored in the URL only: refresh, share and
 * back/forward all keep it. Shared by F1 (overview) and F2 (questions, detail). Owner: T0.
 *
 * Uses useSearchParams, so the calling page must render inside <Suspense> (as the e2 pages already do).
 */
export function useGlobalFilter(): {
  filter: GlobalFilter;
  /** Merges into the URL; `undefined` or '' removes a key. Pushes a history entry, keeps scroll, keeps simulate. */
  setFilter: (patch: Partial<GlobalFilter>) => void;
  /** Clears platform, topic and intent; keeps simulate and any other parameter. */
  reset: () => void;
  /** Drill-down link carrying the current filter + simulate; `extra` keys override filter keys of the same name. */
  buildHref: (path: string, extra?: Record<string, string>) => string;
} {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const searchKey = search.toString();

  const filter = useMemo(() => parseGlobalFilter(new URLSearchParams(searchKey)), [searchKey]);

  const navigate = useCallback(
    (edit: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchKey);
      edit(next);
      // A filter change starts the list from its first page.
      next.delete('page');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchKey],
  );

  const setFilter = useCallback(
    (patch: Partial<GlobalFilter>) =>
      navigate((next) => {
        for (const key of GLOBAL_FILTER_KEYS) {
          if (!(key in patch)) continue;
          const value = patch[key];
          if (value) next.set(key, value);
          else next.delete(key);
        }
      }),
    [navigate],
  );

  const reset = useCallback(() => navigate((next) => GLOBAL_FILTER_KEYS.forEach((key) => next.delete(key))), [navigate]);

  const buildHref = useCallback(
    (path: string, extra: Record<string, string> = {}) => {
      const carried: Record<string, string> = {};
      const current = new URLSearchParams(searchKey);
      for (const key of PASS_THROUGH) {
        const value = current.get(key);
        if (value) carried[key] = value;
      }
      return globalFilterHref(path, filter, { ...extra, ...carried });
    },
    [filter, searchKey],
  );

  return { filter, setFilter, reset, buildHref };
}
