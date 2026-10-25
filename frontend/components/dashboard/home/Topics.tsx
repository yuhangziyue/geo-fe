'use client';

import type { EChartsOption } from 'echarts';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { series } from '../../../design/chartTheme';
import { color } from '../../../design/tokens';
import { AsyncState, Card } from '../AsyncState';
import { EChart, type ChartTable } from '../EChart';
import type { TopicRow } from '../types';
import { useGlobalFilter } from '../useGlobalFilter';
import { asyncProps, ClearFilters, type SummaryApi } from './shared';

/**
 * ⑤-left Visibility by topic (05 / 06 §5.6): horizontal bars, all `series.visibility`; the weakest topic (backend
 * `isWorst`) is `series.lowest` with a "Lowest" tail label — never danger red, which belongs to the action cards.
 */
export function Topics({ api }: { api: SummaryApi }) {
  const router = useRouter();
  const { buildHref } = useGlobalFilter();
  const topics = api.data?.topics;
  const chart = useMemo(() => (topics ? topicChart(topics) : null), [topics]);

  return (
    <Card title="Visibility by topic" subtitle="Weakest topic marked · click a bar to see its questions">
      <AsyncState
        {...asyncProps(api)}
        isEmpty={!!topics && topics.length === 0}
        skeletonHeight={300}
        empty={
          <>
            <p>No questions match these filters.</p>
            <ClearFilters />
          </>
        }
      >
        {() => (
          <EChart
            ariaLabel="Visibility by topic"
            height={Math.max(160, chart!.rows * 34 + 32)}
            option={chart!.option}
            table={chart!.table}
            onClick={({ name }) => router.push(buildHref('/dashboard/questions', { topic: name }))}
          />
        )}
      </AsyncState>
    </Card>
  );
}

function topicChart(topics: TopicRow[]): { option: EChartsOption; table: ChartTable; rows: number } {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const t = topics[list[0]?.dataIndex ?? -1];
        return t ? `<b>${t.topic}</b><br/>Visibility ${t.visibility}% · n=${t.questions}${t.isWorst ? '<br/>Lowest topic' : ''}` : '';
      },
    },
    grid: { left: 8, right: 96, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', inverse: true, data: topics.map((t) => t.topic), axisLabel: { color: color.ink.secondary } },
    series: [
      {
        name: 'Visibility',
        type: 'bar',
        barMaxWidth: 20,
        data: topics.map((t) => ({
          value: t.visibility,
          itemStyle: { color: t.isWorst ? series.lowest : series.visibility },
          label: {
            show: true,
            position: 'right',
            fontSize: 12,
            color: t.isWorst ? color.warning.DEFAULT : color.ink.secondary,
            formatter: t.isWorst ? '{c}% · Lowest' : '{c}%',
          },
        })),
      },
    ],
  };
  return {
    option,
    rows: topics.length,
    table: {
      caption: 'Visibility by topic',
      columns: ['Topic', 'Questions', 'Visibility'],
      rows: topics.map((t) => [t.isWorst ? `${t.topic} (lowest)` : t.topic, t.questions, `${t.visibility}%`]),
    },
  };
}
