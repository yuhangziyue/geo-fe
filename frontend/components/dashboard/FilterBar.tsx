'use client';

import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { DatePicker, Select } from 'antd';
import { INTENT_LABELS, INTENTS, PLATFORMS, type Facets, type GlobalFilter } from './types';
import { useGlobalFilter } from './useGlobalFilter';
import { formatDay } from './home/shared';

const { RangePicker } = DatePicker;

interface FilterBarProps {
  /**
   * Options from the API's `facets` (full data, not the filtered rows). While loading, pass null: platforms and
   * intents fall back to the fixed vocabularies, and the topic list shows only the current value.
   */
  facets: Pick<Facets, 'platforms' | 'topics'> | null;
  /** Default true. Hide where intent does not apply. */
  showIntent?: boolean;
  /** Full reporting window of the data (first ~ last day), for the quick range presets. Null while loading. */
  range?: { from: string; to: string } | null;
  className?: string;
}

/** Range presets anchored on the data's last day: Day = that day, Week = last 7, Month = last 30, Quarter = last 90. */
const RANGE_PRESETS = [
  { key: 'all', label: 'All', days: 0 },
  { key: 'day', label: 'Day', days: 1 },
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'quarter', label: 'Quarter', days: 90 },
] as const;
type RangeKey = (typeof RANGE_PRESETS)[number]['key'];

const DAY_MS = 86_400_000;

/** Shift a YYYY-MM-DD date by whole days (UTC arithmetic: no timezone can shift the day). */
function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * Global filter bar (06 §6): Platform / Topic / Intent antd Selects plus the quick reporting-window presets
 * (All / Day / Week / Month / Quarter) and a Custom trigger (popover with an antd RangePicker, bounded to the
 * data window, writes the URL as soon as both dates are set — 01 §1), all bound to the URL through useGlobalFilter.
 * Platform and Topic search their options; every select clears with antd's allowClear. "Clear all" appears once
 * any filter is set. One row from `sm` up, stacked full-width below it (375). Owner: T0 — F1 / F2 render it,
 * they do not edit it.
 */
export function FilterBar({ facets, showIntent = true, range = null, className = '' }: FilterBarProps) {
  const { filter, setFilter, reset } = useGlobalFilter();
  // Counts every filter in the URL, shown or not: reset clears them all, so "Clear all" must appear whenever one is set.
  const active = Object.values(filter).filter((v) => v !== undefined).length;

  const topics = facets?.topics ?? (filter.topic ? [filter.topic] : []);
  const platforms = facets?.platforms ?? PLATFORMS;
  const to = range?.to;
  const activeRange: RangeKey | 'custom' =
    !filter.from && !filter.to
      ? 'all'
      : RANGE_PRESETS.find((p) => to && filter.from === shiftDays(to, 1 - p.days) && filter.to === to)?.key ?? 'custom';

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const customLabel =
    filter.from && filter.to
      ? filter.from === filter.to
        ? formatDay(filter.from)
        : `${formatDay(filter.from)} – ${formatDay(filter.to)}`
      : 'Custom';

  return (
    <div role="group" aria-label="Filters" className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end ${className}`}>
      <div ref={wrapRef} className="relative flex w-full flex-col gap-1 sm:w-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-ink-secondary">Range</span>
          {(filter.from || filter.to) && (
            <button
              type="button"
              onClick={() => setFilter({ from: undefined, to: undefined })}
              aria-label="Clear range filter"
              className="text-xs font-medium text-brand hover:text-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              Clear
            </button>
          )}
        </div>
        <div role="group" aria-label="Report range" className="flex items-center rounded-md border border-line bg-surface-sunken p-0.5">
          {RANGE_PRESETS.map((p) => {
            const disabled = p.key !== 'all' && (p.key === 'quarter' ? !range || daysBetween(range.from, range.to) < p.days : !to);
            const pressed = activeRange === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={pressed}
                disabled={disabled}
                title={
                  p.key === 'quarter' && range && daysBetween(range.from, range.to) < p.days
                    ? `Data covers ${daysBetween(range.from, range.to)} days — not enough for a quarter`
                    : undefined
                }
                onClick={() =>
                  setFilter(
                    p.key === 'all' ? { from: undefined, to: undefined } : { from: shiftDays(to!, 1 - p.days), to },
                  )
                }
                className={`focus-ring rounded px-2 py-1 text-xs font-medium transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
                  pressed ? 'bg-surface-card text-ink' : 'text-ink-tertiary hover:text-ink-secondary'
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={activeRange === 'custom'}
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={!range}
            onClick={() => setOpen((o) => !o)}
            className={`focus-ring rounded px-2 py-1 text-xs font-medium transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
              activeRange === 'custom' ? 'bg-surface-card text-ink' : 'text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            {customLabel}
          </button>
        </div>
        {open && (
          <div
            role="dialog"
            aria-label="Custom date range"
            className="absolute left-0 top-full z-20 mt-1 w-full rounded-xl border border-line bg-surface-card p-3 shadow-md sm:w-96"
          >
            <RangePicker
              value={filter.from && filter.to ? [dayjs(filter.from), dayjs(filter.to)] : undefined}
              autoFocus
              allowClear
              disabledDate={(current) => {
                const day = current.format('YYYY-MM-DD');
                return !range || day < range.from || day > range.to;
              }}
              onChange={(dates, dateStrings) => {
                if (!dates) {
                  setFilter({ from: undefined, to: undefined });
                  return;
                }
                const [from, to] = dateStrings ?? [];
                if (from && to) {
                  setFilter({ from, to });
                  // Modeless: a valid pair applies immediately, so the popover closes itself.
                  setOpen(false);
                }
              }}
              getPopupContainer={(node) => wrapRef.current ?? node.parentElement ?? node}
              className="w-full"
            />
          </div>
        )}
      </div>
      <FilterSelect
        label="Platform"
        value={filter.platform}
        allLabel="All platforms"
        searchable
        options={platforms.map((p) => ({ value: p, label: p }))}
        onChange={(v) => setFilter({ platform: (v || undefined) as GlobalFilter['platform'] })}
      />
      <FilterSelect
        label="Topic"
        value={filter.topic}
        allLabel="All topics"
        searchable
        options={topics.map((t) => ({ value: t, label: t }))}
        onChange={(v) => setFilter({ topic: v || undefined })}
      />
      {showIntent && (
        <FilterSelect
          label="Intent"
          value={filter.intent}
          allLabel="All intents"
          options={INTENTS.map((t) => ({ value: t, label: `${t} · ${INTENT_LABELS[t].name}` }))}
          onChange={(v) => setFilter({ intent: (v || undefined) as GlobalFilter['intent'] })}
        />
      )}
      {active > 0 && (
        <button
          type="button"
          onClick={reset}
          className="h-9 self-start rounded-md px-2 text-sm font-medium text-brand hover:text-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:self-end"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterSelect(props: {
  label: string;
  value?: string;
  allLabel: string;
  searchable?: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string | undefined) => void;
}) {
  const { label, value, allLabel, searchable, options, onChange } = props;
  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <span className="text-xs font-medium text-ink-secondary">{label}</span>
      <Select
        aria-label={label}
        value={value}
        allowClear
        showSearch={searchable}
        placeholder={allLabel}
        options={options}
        onChange={(v) => onChange(v ?? undefined)}
        className="w-full sm:w-48"
      />
    </div>
  );
}
