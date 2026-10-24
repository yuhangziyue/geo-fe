'use client';

import { useEffect, useRef } from 'react';
import type { ECharts, EChartsOption } from 'echarts';

interface Props {
  option: EChartsOption;
  height?: number;
  onClick?: (params: { name: string; seriesName?: string; dataIndex: number }) => void;
  ariaLabel: string;
}

/** ECharts wrapper: loads echarts on the client only, follows its container's size, disposes on unmount. */
export function EChart({ option, height = 300, onClick, ariaLabel }: Props) {
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
      chart.current = echarts.init(el.current) as unknown as ECharts;
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
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height, width: '100%' }} />;
}
