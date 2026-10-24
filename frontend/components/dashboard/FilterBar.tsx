'use client';

import { useId } from 'react';
import { INTENT_LABELS, INTENTS, PLATFORMS, type Facets, type GlobalFilter } from './types';
import { useGlobalFilter } from './useGlobalFilter';

interface FilterBarProps {
  /**
   * Options from the API's `facets` (full data, not the filtered rows). While loading, pass null: platforms and
   * intents fall back to the fixed vocabularies, and the topic list shows only the current value.
   */
  facets: Pick<Facets, 'platforms' | 'topics'> | null;
  /** Default true. Hide where intent does not apply. */
  showIntent?: boolean;
  className?: string;
}

/**
 * Global filter bar (06 §6): Platform / Topic / Intent selects bound to the URL through useGlobalFilter.
 * A select with a value gets the brand border and its own Clear; "Clear all" appears once any filter is set.
 * One row from `sm` up, stacked full-width below it (375). Owner: T0 — F1 / F2 render it, they do not edit it.
 */
export function FilterBar({ facets, showIntent = true, className = '' }: FilterBarProps) {
  const { filter, setFilter, reset } = useGlobalFilter();
  const active = (showIntent ? (['platform', 'topic', 'intent'] as const) : (['platform', 'topic'] as const)).filter(
    (key) => filter[key] !== undefined,
  ).length;

  const topics = facets?.topics ?? (filter.topic ? [filter.topic] : []);
  const platforms = facets?.platforms ?? PLATFORMS;

  return (
    <div role="group" aria-label="Filters" className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end ${className}`}>
      <FilterSelect
        label="Platform"
        value={filter.platform ?? ''}
        allLabel="All platforms"
        options={platforms.map((p) => ({ value: p, label: p }))}
        onChange={(v) => setFilter({ platform: (v || undefined) as GlobalFilter['platform'] })}
      />
      <FilterSelect
        label="Topic"
        value={filter.topic ?? ''}
        allLabel="All topics"
        options={topics.map((t) => ({ value: t, label: t }))}
        onChange={(v) => setFilter({ topic: v || undefined })}
      />
      {showIntent && (
        <FilterSelect
          label="Intent"
          value={filter.intent ?? ''}
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
  value: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const { label, value, allLabel, options, onChange } = props;
  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink-secondary">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Clear ${label.toLowerCase()} filter`}
            className="text-xs font-medium text-brand hover:text-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            Clear
          </button>
        )}
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 w-full rounded-md border bg-surface-card px-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:w-48 ${
          value ? 'border-brand' : 'border-line-strong'
        }`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
