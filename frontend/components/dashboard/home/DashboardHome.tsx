'use client';

import { Tabs } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ActionCenter } from '../action/ActionCenter';
import { FilterBar } from '../FilterBar';
import type { Summary } from '../types';
import { useApi } from '../useApi';
import { useGlobalFilter } from '../useGlobalFilter';
import { CoverageWordCloud } from './CoverageWordCloud';
import { Funnel } from './Funnel';
import { Intents } from './Intents';
import { Matrix } from './Matrix';
import { Platforms } from './Platforms';
import { Sources } from './Sources';
import { formatPeriod } from './shared';
import { Topics } from './Topics';
import { Trend } from './Trend';

/**
 * Home (05 §2 as re-ordered by 06 §1.1, ruled 10-24): two views behind a tab switch (?tab=insights).
 * ① Data (看结果): header + filters → funnel → matrix → coverage word cloud → platforms | trend → topics | intents →
 * sources. ② AI Insights (给行动方向): the action center. One summary request (filter + simulate from the URL)
 * feeds every data block except the action center, which loads its own cards. Each block owns its Loading/Empty/Error.
 */
export function DashboardHome() {
  const { buildHref } = useGlobalFilter();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const summary = useApi<Summary>(buildHref('/api/dashboard/summary'));
  const data = summary.data;
  const tab = search.get('tab') === 'insights' ? 'insights' : 'data';

  const setTab = (next: 'data' | 'insights') => {
    const params = new URLSearchParams(search.toString());
    if (next === 'insights') params.set('tab', 'insights');
    else params.delete('tab');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const range = data ? { from: data.periodHalves.first.from, to: data.periodHalves.last.to } : null;

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{data?.brand ?? 'AsterVision'} · AI Visibility</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          How AI assistants mention, recommend and cite the brand{data ? ` · ${formatPeriod(data.period)}` : ''}
        </p>
      </div>

      <Tabs
        aria-label="Report view"
        activeKey={tab}
        onChange={(k) => setTab(k as 'data' | 'insights')}
        items={[
          { key: 'data', label: 'Data' },
          { key: 'insights', label: 'AI Insights' },
        ]}
        className="[&_.ant-tabs-nav]:!mb-0"
      />

      <FilterBar facets={data?.facets ?? null} range={range} />

      {tab === 'data' ? (
        <>
          <Funnel api={summary} />
          <Matrix api={summary} />
          <CoverageWordCloud />
          <div className="grid gap-6 lg:grid-cols-2">
            <Platforms api={summary} />
            <Trend api={summary} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Topics api={summary} />
            <Intents api={summary} />
          </div>
          <Sources api={summary} />
        </>
      ) : (
        <ActionCenter />
      )}
    </div>
  );
}
