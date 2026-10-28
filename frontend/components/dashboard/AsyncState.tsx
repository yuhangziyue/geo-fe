'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Card as AntCard } from 'antd';
import { color } from '../../design/tokens';

interface Props {
  status: 'loading' | 'error' | 'ok';
  error?: string | null;
  isEmpty?: boolean;
  /** Newer data is loading: keep showing the current content, dimmed. */
  refreshing?: boolean;
  onRetry?: () => void;
  empty?: ReactNode;
  skeletonHeight?: number;
  /** A skeleton shaped like the final content (06 §5: same size as the end state, no layout jump). */
  skeleton?: ReactNode;
  children: () => ReactNode;
}

/**
 * One wrapper for the three async states every data block must handle (06 §5 通则).
 * loading = `surface-sunken` skeleton (no pulse under reduced motion) · error = `danger-subtle` block + Retry ·
 * empty = one sentence of conclusion + at most one action, no illustration.
 * Owner: F1 (shared with F2, who use it without editing it).
 */
export function AsyncState({ status, error, isEmpty, refreshing, onRetry, empty, skeletonHeight = 160, skeleton, children }: Props) {
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading" className="motion-safe:animate-pulse" style={{ minHeight: skeletonHeight }}>
        {skeleton ?? (
          <div className="space-y-3">
            <div className="h-4 w-1/3 rounded-md bg-surface-sunken" />
            <div className="h-4 w-2/3 rounded-md bg-surface-sunken" />
            <div className="h-4 w-1/2 rounded-md bg-surface-sunken" />
          </div>
        )}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-line bg-danger-subtle p-4 text-sm">
        <p className="font-medium text-danger">Couldn&apos;t load this section</p>
        <p className="text-danger">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring rounded-md border border-line-strong bg-surface-card px-3 py-1.5 font-medium text-danger transition-colors duration-[120ms] ease-out hover:bg-danger-subtle"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  const body = isEmpty ? (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-ink-secondary">
      {empty ?? <p>No data for this selection.</p>}
    </div>
  ) : (
    children()
  );
  return (
    <div aria-busy={refreshing || undefined} className={refreshing ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}>
      {body}
    </div>
  );
}

/**
 * P1 signal console material (docs/dashboard-design-optimization-v1.md §2): surface-console (#0F172A) with a
 * fine hairline grid from pure CSS gradients — no image, no extra colour (the lines are line-console #1E293B).
 */
const CONSOLE_GRID: CSSProperties = {
  backgroundColor: color.surface.console,
  borderColor: color.line.console,
  backgroundImage:
    'linear-gradient(rgba(30,41,59,0.85) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.85) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};

/** Card chrome: 1px `line` border, no shadow (06 §4), radius 12, padding 20. */
export function Card({
  title,
  subtitle,
  action,
  className = '',
  tone = 'default',
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** 'console' renders the dark signal-console material (P1 Overall trend only). */
  tone?: 'default' | 'console';
  children: ReactNode;
}) {
  const onConsole = tone === 'console';
  return (
    <section className={`min-w-0 ${className}`}>
      <AntCard
        title={
          <div className="min-w-0">
            <h2 className={`text-base font-semibold ${onConsole ? 'text-ink-inverse' : 'text-ink'}`}>{title}</h2>
            {subtitle && <p className={`mt-0.5 text-sm ${onConsole ? 'text-ink-on-console' : 'text-ink-secondary'}`}>{subtitle}</p>}
          </div>
        }
        extra={action}
        style={onConsole ? CONSOLE_GRID : undefined}
        styles={{ body: { padding: 20, background: 'transparent' }, header: { paddingTop: 20, paddingBottom: 12, background: 'transparent' } }}
        classNames={{ header: '[&_.ant-card-head-title]:!overflow-visible [&_.ant-card-head-title]:!whitespace-normal' }}
        className={`rounded-xl ${onConsole ? 'border-line-console' : 'border-line'}`}
      >
        {children}
      </AntCard>
    </section>
  );
}
