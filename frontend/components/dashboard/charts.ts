import type { EChartsOption } from 'echarts';
import type { ChartTable } from './EChart';
import type { Summary } from './types';

// Pure builders: summary data → chart option + the same numbers as a table (for screen readers and copying).

const WEAK_TOPIC_COLOR = '#e11d48';
const BASE_COLOR = '#6366f1';

export function platformChart(data: Summary): { option: EChartsOption; table: ChartTable } {
  const ps = data.platforms;
  return {
    option: {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 40, right: 48, top: 40, bottom: 48 },
      xAxis: { type: 'category', data: ps.map((p) => p.name) },
      yAxis: [
        { type: 'value', name: 'Count' },
        { type: 'value', name: 'Visibility %', max: 100, axisLabel: { formatter: '{value}%' } },
      ],
      series: [
        { name: 'Mentions', type: 'bar', data: ps.map((p) => p.mentions), itemStyle: { color: '#a5b4fc' } },
        { name: 'Recommendations', type: 'bar', data: ps.map((p) => p.recommendations), itemStyle: { color: BASE_COLOR } },
        { name: 'Citations', type: 'bar', data: ps.map((p) => p.citations), itemStyle: { color: '#94a3b8' } },
        {
          name: 'Visibility %',
          type: 'line',
          yAxisIndex: 1,
          data: ps.map((p) => p.visibility),
          itemStyle: { color: '#f59e0b' },
          label: { show: true, formatter: '{c}%' },
        },
      ],
    },
    table: {
      caption: 'Metrics by platform',
      columns: ['Platform', 'Questions', 'Mentions', 'Recommendations', 'Citations', 'Visibility'],
      rows: ps.map((p) => [p.name, p.questions, p.mentions, p.recommendations, p.citations, `${p.visibility}%`]),
    },
  };
}

export function trendChart(data: Summary): { option: EChartsOption; table: ChartTable } {
  const ts = data.trend;
  return {
    option: {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 40, right: 48, top: 40, bottom: 48 },
      xAxis: { type: 'category', data: ts.map((t) => t.date.slice(5)) },
      yAxis: [
        { type: 'value', name: 'Count', minInterval: 1 },
        { type: 'value', name: 'Visibility %', max: 100, axisLabel: { formatter: '{value}%' } },
      ],
      series: [
        { name: 'Mentions', type: 'line', data: ts.map((t) => t.mentions), itemStyle: { color: '#a5b4fc' } },
        { name: 'Recommendations', type: 'line', data: ts.map((t) => t.recommendations), itemStyle: { color: BASE_COLOR } },
        { name: 'Visibility %', type: 'line', yAxisIndex: 1, smooth: true, data: ts.map((t) => t.visibility), itemStyle: { color: '#f59e0b' } },
      ],
    },
    table: {
      caption: 'Daily trend',
      columns: ['Date', 'Mentions', 'Recommendations', 'Visibility'],
      rows: ts.map((t) => [t.date, t.mentions, t.recommendations, `${t.visibility}%`]),
    },
  };
}

export function topicChart(data: Summary): { option: EChartsOption; table: ChartTable } {
  const topics = [...data.topics].sort((a, b) => a.visibility - b.visibility);
  const min = Math.min(...topics.map((t) => t.visibility));
  return {
    option: {
      tooltip: {
        trigger: 'axis',
        formatter: (p: unknown) => {
          const t = topics[(p as Array<{ dataIndex: number }>)[0].dataIndex];
          return `${t.topic}<br/>Visibility ${t.visibility}%<br/>${t.recommendations} recommendations / ${t.questions} questions`;
        },
      },
      grid: { left: 150, right: 40, top: 8, bottom: 24 },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: { type: 'category', data: topics.map((t) => t.topic) },
      series: [
        {
          type: 'bar',
          data: topics.map((t) => ({ value: t.visibility, itemStyle: { color: t.visibility === min ? WEAK_TOPIC_COLOR : BASE_COLOR } })),
          label: { show: true, position: 'right', formatter: '{c}%' },
        },
      ],
    },
    table: {
      caption: 'Visibility by topic, weakest first',
      columns: ['Topic', 'Questions', 'Recommendations', 'Visibility', 'Scenario page'],
      rows: topics.map((t) => [t.topic, t.questions, t.recommendations, `${t.visibility}%`, t.scenario?.name ?? '—']),
    },
  };
}
