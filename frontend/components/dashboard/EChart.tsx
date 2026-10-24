'use client';

import { useEffect, useRef } from 'react';
import type { ECharts, EChartsOption } from 'echarts';

interface Props {
  option: EChartsOption;
  height?: number;
  onClick?: (params: { name: string; seriesName?: string; dataIndex: number }) => void;
  ariaLabel: string;
}

/** ECharts wrapper: loads echarts on the client only, resizes with the window, disposes on unmount. */
export function EChart({ option, height = 300, onClick, ariaLabel }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    let disposed = false;
    const onResize = () => chart.current?.resize();
    import('echarts').then((echarts) => {
      if (disposed || !el.current) return;
      chart.current = echarts.init(el.current);
      chart.current.setOption(option);
      chart.current.on('click', (p) =>
        clickRef.current?.({ name: String(p.name), seriesName: p.seriesName, dataIndex: p.dataIndex }),
      );
      window.addEventListener('resize', onResize);
    });
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      chart.current?.dispose();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height, width: '100%' }} />;
}
