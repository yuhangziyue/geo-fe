'use client';

import { ActionCenter } from '../action/ActionCenter';
import { FilterBar } from '../FilterBar';
import type { Summary } from '../types';
import { useApi } from '../useApi';
import { useGlobalFilter } from '../useGlobalFilter';
import { Funnel } from './Funnel';
import { Intents } from './Intents';
import { Matrix } from './Matrix';
import { Platforms } from './Platforms';
import { Sources } from './Sources';
import { formatPeriod } from './shared';
import { Topics } from './Topics';
import { Trend } from './Trend';

/**
 * Home (05 §2 as re-ordered by 06 §1.1, ruled 10-24): ① header + filters → ② funnel → ③ matrix → ④ action center →
 * ⑤ platforms | trend → ⑥ topics | intents → ⑦ sources. One summary request (filter + simulate from the URL)
 * feeds every block except the action center, which loads its own cards. Each block owns its Loading/Empty/Error.
 */
export function DashboardHome() {
  const { buildHref } = useGlobalFilter();
  const summary = useApi<Summary>(buildHref('/api/dashboard/summary'));
  const data = summary.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{data?.brand ?? 'AsterVision'} · AI Visibility</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            How AI assistants mention, recommend and cite the brand{data ? ` · ${formatPeriod(data.period)}` : ''}
          </p>
        </div>
        <FilterBar facets={data?.facets ?? null} />
      </div>

      <Funnel api={summary} />
      <Matrix api={summary} />
      <ActionCenter />

      <div className="grid gap-6 lg:grid-cols-2">
        <Platforms api={summary} />
        <Trend api={summary} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Topics api={summary} />
        <Intents api={summary} />
      </div>

      <Sources api={summary} />
    </div>
  );
}
