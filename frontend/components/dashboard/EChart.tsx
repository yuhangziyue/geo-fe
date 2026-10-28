'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';

/** The chart's numbers as a table: a canvas is opaque to screen readers and cannot be copied from. */
export interface ChartTable {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

interface Props {
  option: EChartsOption;
  height?: number;
  onClick?: (params: { name: string; seriesName?: string; dataIndex: number }) => void;
  ariaLabel: string;
  table?: ChartTable;
  /** Show the chart/table switch in the top-right corner when `table` is provided (default on). */
  tableToggle?: boolean;
  /** ECharts theme registered in echarts.ts. The console chart opts into 'geoConsole' (P1 signal console). */
  theme?: 'geo' | 'geoConsole';
  /** 'console' restyles the Chart/Table toggle and the data table for the dark surface (default light). */
  tone?: 'light' | 'console';
}

/** ECharts wrapper: loads echarts on the client only, follows its container's size, disposes on unmount. */
export function EChart({ option, height = 300, onClick, ariaLabel, table, tableToggle = true, theme = 'geo', tone = 'light' }: Props) {
  const tableId = useId();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const optionRef = useRef(option);
  optionRef.current = option;

  useEffect(() => {
    let disposed = false;
    // Watches the container, not the window: grid reflows and sidebars resize charts too.
    const observer = new ResizeObserver(() => chart.current?.resize());
    import('./echarts').then((echarts) => {
      if (disposed || !el.current) return;
      chart.current = echarts.init(el.current, theme) as unknown as ECharts;
      // Latest option, in case it changed while echarts was loading.
      chart.current.setOption(optionRef.current);
      chart.current.on('click', (p) =>
        clickRef.current?.({ name: String(p.name), seriesName: p.seriesName, dataIndex: p.dataIndex }),
      );
      observer.observe(el.current);
    });
    return () => {
      disposed = true;
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, [theme]);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  useEffect(() => {
    if (!table) setView('chart');
  }, [table]);

  const toggle = (
    <div className="flex justify-end">
      <div
        role="group"
        aria-label="Chart or table view"
        className={`flex items-center rounded-md border p-0.5 ${
          tone === 'console' ? 'border-line-console bg-line-console' : 'border-line bg-surface-sunken'
        }`}
      >
        {(['chart', 'table'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`focus-ring rounded px-2 py-0.5 text-xs font-medium transition-colors duration-[120ms] ease-out ${
              tone === 'console'
                ? view === v
                  ? 'bg-surface-console text-ink-inverse'
                  : 'text-ink-on-console hover:text-ink-inverse'
                : view === v
                  ? 'bg-surface-card text-ink'
                  : 'text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            {v === 'chart' ? 'Chart' : 'Table'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {table && tableToggle && <div className="mb-2">{toggle}</div>}
      <div
        ref={el}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={table ? tableId : undefined}
        className={view === 'table' ? 'hidden' : undefined}
        style={{ height, width: '100%' }}
      />
      {table && (
        view === 'table' && (
          // Cap the table at the chart's height so switching Chart ⇄ Table never resizes the card (06 §5).
          <div className="overflow-auto" style={{ maxHeight: height }}>
            <table id={tableId} className="w-full text-left text-xs">
              <caption className="sr-only">{table.caption}</caption>
              <thead className={`border-b ${tone === 'console' ? 'border-line-console text-ink-on-console' : 'border-line text-ink-tertiary'}`}>
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={`py-1.5 pr-3 font-medium ${i > 0 ? 'text-right' : ''}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y tabular-nums ${tone === 'console' ? 'divide-line-console' : 'divide-surface-sunken'}`}>
                {table.rows.map((r) => (
                  <tr key={String(r[0])}>
                    {r.map((cell, i) =>
                      i === 0 ? (
                        <th key={i} scope="row" className={`py-1.5 pr-3 font-normal ${tone === 'console' ? 'text-ink-inverse' : 'text-ink-secondary'}`}>{cell}</th>
                      ) : (
                        <td key={i} className={`py-1.5 pr-3 text-right ${tone === 'console' ? 'text-ink-on-console' : 'text-ink-secondary'}`}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
