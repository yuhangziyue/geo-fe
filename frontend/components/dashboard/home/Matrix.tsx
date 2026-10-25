'use client';

import Link from 'next/link';
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { AsyncState, Card } from '../AsyncState';
import { INTENT_LABELS, type IntentTier, type MatrixCell, type MatrixDTO, type MatrixRow, type MatrixState, type Platform } from '../types';
import { useGlobalFilter } from '../useGlobalFilter';
import { asyncProps, ClearFilters, formatDay, INTENT_BADGE_CLASS, PLATFORM_ABBR, type SummaryApi } from './shared';

/** Rows shown before "Show all" (05 §2.3). */
const TOP_ROWS = 12;

/** Display names of the five states, in the legend's order (darkest = most present → hole → untracked). */
const STATE_NAME: Record<MatrixState, string> = {
  recommended: 'Recommended',
  partly: 'Partly recommended',
  mentioned_only: 'Mentioned only',
  not_mentioned: 'Not mentioned',
  not_tracked: 'Not tracked',
};
const LEGEND_ORDER: readonly MatrixState[] = ['recommended', 'partly', 'mentioned_only', 'not_mentioned', 'not_tracked'];

/** 06 §3.3: one hue, lighter = less AI presence; the hole is white with a dark 1.5px border; untracked is hatched. */
const CELL_CLASS: Record<MatrixState, string> = {
  recommended: 'bg-cov-rec text-cov-rec-ink',
  partly: 'bg-cov-partly text-cov-partly-ink',
  mentioned_only: 'border border-cov-mentioned-line bg-cov-mentioned text-cov-mentioned-ink',
  not_mentioned: 'border-[1.5px] border-cov-none-line bg-cov-none text-cov-none-ink',
  not_tracked: 'cov-untracked text-cov-untracked-ink',
};

/** Row template: header column + 5 platform columns (1440: 280+/56 · 1024: 220+/52 · <768: stacked, 5 × 1fr). */
const ROW_GRID =
  'grid grid-cols-5 gap-1 md:grid-cols-[minmax(220px,1fr)_repeat(5,52px)] md:items-center xl:grid-cols-[minmax(280px,1fr)_repeat(5,56px)]';

/**
 * ③ Question × platform matrix — the "AI coverage map" (05 §2.3, 06 §2 / §5.2). Renders `summary.matrix` as is:
 * the five states, the gap-score order and the counts all come from the backend; this file never derives them.
 */
export function Matrix({ api }: { api: SummaryApi }) {
  const m = api.data?.matrix;
  return (
    <Card
      title="AI coverage map"
      subtitle="Each question on each platform · darker = AI mentions and recommends the brand more; white holes are the gaps to fill"
    >
      <AsyncState
        {...asyncProps(api)}
        isEmpty={!!m && m.rows.length === 0}
        skeletonHeight={12 * 44}
        skeleton={<MatrixSkeleton />}
        empty={
          <>
            <p>No questions match these filters.</p>
            <ClearFilters />
          </>
        }
      >
        {/* Keyed by the DATA's flag, not the URL: useApi keeps the previous data while the next request loads, so a
            URL key would remount with the stale flag. Platform added → collapsed (hint + expand); cleared → expanded. */}
        {() => <MatrixBody key={m!.collapsedByDefault ? 'collapsed' : 'open'} m={m!} />}
      </AsyncState>
    </Card>
  );
}

function MatrixBody({ m }: { m: MatrixDTO }) {
  const { setFilter } = useGlobalFilter();
  const [open, setOpen] = useState(!m.collapsedByDefault);
  const [showAll, setShowAll] = useState(false);
  const counts = m.stateCounts;
  const allHealthy = counts.not_mentioned + counts.mentioned_only + counts.partly === 0;

  return (
    <div className="space-y-4">
      {m.collapsedByDefault && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-secondary">
          <p className="min-w-0 flex-1">Matrix compares platforms — clear the platform filter to use it.</p>
          <button type="button" onClick={() => setFilter({ platform: undefined })} className="focus-ring rounded-md font-medium text-brand hover:text-brand-hover hover:underline">
            Clear platform
          </button>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="focus-ring rounded-md font-medium text-ink-secondary hover:text-ink hover:underline"
          >
            {open ? 'Hide matrix' : 'Show matrix'}
          </button>
        </div>
      )}

      {open && (
        <>
          <Legend counts={counts} />
          {allHealthy && <p className="text-sm text-ink-secondary">Every tracked question is recommended on every platform it was asked.</p>}
          <Grid m={m} rows={showAll ? m.rows : m.rows.slice(0, TOP_ROWS)} />
          {m.rows.length > TOP_ROWS && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="focus-ring rounded-md text-sm font-medium text-brand hover:text-brand-hover hover:underline"
            >
              {showAll ? `Show top ${TOP_ROWS}` : `Show all ${m.rows.length} questions`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Legend({ counts }: { counts: Record<MatrixState, number> }) {
  return (
    <div className="space-y-1">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary" aria-label="Legend">
        {LEGEND_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block h-3 w-4 rounded-md ${CELL_CLASS[s]}`} />
            {STATE_NAME[s]} <span className="tabular-nums text-ink-tertiary">{counts[s]}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-tertiary xl:hidden">
        {(Object.keys(PLATFORM_ABBR) as Platform[]).map((p) => `${PLATFORM_ABBR[p]} ${p}`).join(' · ')}
      </p>
    </div>
  );
}

type Pos = { r: number; c: number };

const tracked = (row: MatrixRow | undefined, c: number) => !!row && row.cells[c]?.state !== 'not_tracked' && row.cells[c]?.latestRunId != null;

function firstTracked(rows: MatrixRow[]): Pos | null {
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < 5; c++) if (tracked(rows[r], c)) return { r, c };
  return null;
}

/** Nearest tracked column in `row` to `c` (ties go left), or null. */
function nearestInRow(row: MatrixRow, c: number): number | null {
  for (let d = 0; d < row.cells.length; d++) {
    if (tracked(row, c - d)) return c - d;
    if (tracked(row, c + d)) return c + d;
  }
  return null;
}

/**
 * role="grid" with a roving tabindex (06 §5.2): Tab lands on one cell, arrows move (skipping Not tracked),
 * Home / End go to the row's first / last cell, Enter opens it, Tab leaves the grid.
 */
function Grid({ m, rows }: { m: MatrixDTO; rows: MatrixRow[] }) {
  const { buildHref } = useGlobalFilter();
  const refs = useRef(new Map<string, HTMLAnchorElement>());
  const [pos, setPos] = useState<Pos | null>(null);
  const active = pos && pos.r < rows.length && tracked(rows[pos.r], pos.c) ? pos : firstTracked(rows);

  const moveTo = useCallback((next: Pos) => {
    setPos(next);
    refs.current.get(`${next.r}:${next.c}`)?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Only keys pressed on a cell move the roving focus; row-header links keep their native behaviour.
    if (!active || !(e.target as HTMLElement).closest('[role="gridcell"]')) return;
    const { r, c } = active;
    const row = rows[r]!;
    let next: Pos | null = null;
    const scanRow = (from: number, step: 1 | -1) => {
      for (let i = from; i >= 0 && i < 5; i += step) if (tracked(row, i)) return { r, c: i };
      return null;
    };
    const scanCol = (step: 1 | -1) => {
      for (let i = r + step; i >= 0 && i < rows.length; i += step) {
        const col = nearestInRow(rows[i]!, c);
        if (col !== null) return { r: i, c: col };
      }
      return null;
    };
    switch (e.key) {
      case 'ArrowRight': next = scanRow(c + 1, 1); break;
      case 'ArrowLeft': next = scanRow(c - 1, -1); break;
      case 'ArrowDown': next = scanCol(1); break;
      case 'ArrowUp': next = scanCol(-1); break;
      case 'Home': next = scanRow(0, 1); break;
      case 'End': next = scanRow(4, -1); break;
      default: return;
    }
    e.preventDefault();
    if (next) moveTo(next);
  };

  return (
    <div role="grid" aria-label="Questions by platform" aria-rowcount={m.rows.length + 1} onKeyDown={onKeyDown} className="text-sm">
      <div role="row" className={`${ROW_GRID} border-b md:sticky md:top-0 md:z-10 border-line bg-surface-card py-1`}>
        <div role="columnheader" className="hidden text-xs font-medium text-ink-secondary md:block">Question</div>
        {m.platforms.map((p) => (
          <div key={p} role="columnheader" title={p} aria-label={p} className="whitespace-nowrap text-center text-xs font-medium text-ink-secondary">
            <span className="xl:hidden">{PLATFORM_ABBR[p]}</span>
            <span className="hidden xl:inline">{p}</span>
          </div>
        ))}
      </div>
      {rows.map((row, r) => (
        <div key={row.question} role="row" aria-rowindex={r + 2} className={`${ROW_GRID} group/row border-b border-line py-2 last:border-b-0 md:py-1`}>
          <div role="rowheader" className="col-span-5 flex min-w-0 items-start gap-2 rounded-md px-1 py-0.5 transition-colors duration-[120ms] ease-out group-hover/row:bg-surface-sunken md:col-span-1">
            <IntentBadge tier={row.intent} />
            <div className="min-w-0">
              <Link
                href={buildHref('/dashboard/questions', { q: row.question })}
                title={row.question}
                className="focus-ring line-clamp-2 rounded-md text-sm text-ink hover:underline md:line-clamp-1"
              >
                {row.question}
              </Link>
              <p className="truncate text-xs text-ink-tertiary">{row.topic}</p>
            </div>
          </div>
          {row.cells.map((cell, c) => (
            <Cell
              key={m.platforms[c]}
              cell={cell}
              platform={m.platforms[c]!}
              alignRight={c >= 3}
              href={cell.latestRunId != null ? buildHref(`/dashboard/questions/${cell.latestRunId}`) : null}
              tabIndex={active && active.r === r && active.c === c ? 0 : -1}
              onFocus={() => setPos({ r, c })}
              register={(el) => {
                const key = `${r}:${c}`;
                if (el) refs.current.set(key, el);
                else refs.current.delete(key);
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function IntentBadge({ tier }: { tier: IntentTier | null }) {
  if (!tier) return <span aria-hidden className="mt-0.5 inline-block h-5 w-5 shrink-0" />;
  return (
    <span
      title={`Intent ${tier} · ${INTENT_LABELS[tier].name}`}
      aria-label={`Intent ${tier}, ${INTENT_LABELS[tier].name}`}
      role="img"
      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-semibold ${INTENT_BADGE_CLASS[tier]}`}
    >
      {tier}
    </span>
  );
}

function Cell(props: {
  cell: MatrixCell;
  platform: Platform;
  alignRight: boolean;
  href: string | null;
  tabIndex: number;
  onFocus: () => void;
  register: (el: HTMLAnchorElement | null) => void;
}) {
  const { cell, platform, alignRight, href, tabIndex, onFocus, register } = props;
  const name = STATE_NAME[cell.state];
  const isTracked = cell.state !== 'not_tracked' && href !== null;
  const latest = cell.latestDate ? `Latest run ${formatDay(cell.latestDate)}` : null;
  const ariaLabel = isTracked
    ? `${platform}: ${name}, recommended ${cell.recommended} of ${cell.n}, mentioned ${cell.mentioned} of ${cell.n}${latest ? `, ${latest.toLowerCase()}` : ''}`
    : `${platform}: Not tracked`;
  const box = `flex h-9 w-full items-center justify-center rounded-md text-xs font-semibold tabular-nums ${CELL_CLASS[cell.state]}`;
  const tip = (
    <span
      role="tooltip"
      className={`pointer-events-none absolute top-full z-20 mt-1 hidden w-56 rounded-xl border border-line bg-surface-card px-3 py-2 text-left text-xs font-normal leading-5 text-ink-secondary shadow-md group-hover/cell:block ${
        isTracked ? 'group-focus-within/cell:block' : ''
      } ${alignRight ? 'right-0' : 'left-0'}`}
    >
      {/* 05 §2.3 / T-FIX: "<Platform> · <state> · Latest run <Mon D>" */}
      <span className="block font-medium text-ink">
        {platform} · {name}
        {isTracked && latest ? ` · ${latest}` : ''}
      </span>
      {isTracked ? (
        <>
          <span className="block tabular-nums">
            Recommended {cell.recommended}/{cell.n} · Mentioned {cell.mentioned}/{cell.n}
          </span>
          <span className="block">Click to open the latest run</span>
        </>
      ) : (
        <span className="block">Not tracked on {platform}</span>
      )}
    </span>
  );

  return (
    <div role="gridcell" className="group/cell relative min-w-0">
      {isTracked ? (
        <Link
          ref={register}
          href={href}
          tabIndex={tabIndex}
          onFocus={onFocus}
          aria-label={ariaLabel}
          className={`${box} focus-ring transition-shadow duration-[120ms] ease-out hover:ring-2 hover:ring-ink`}
        >
          <span aria-hidden>{cell.label}</span>
        </Link>
      ) : (
        <div aria-label={ariaLabel} role="img" className={box}>
          <span aria-hidden>{cell.label}</span>
        </div>
      )}
      {tip}
    </div>
  );
}

function MatrixSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: TOP_ROWS }, (_, i) => (
        <div key={i} className={ROW_GRID}>
          <div className="col-span-5 h-4 w-3/4 rounded-md bg-surface-sunken md:col-span-1" />
          {[0, 1, 2, 3, 4].map((c) => (
            <div key={c} className="h-9 rounded-md bg-surface-sunken" />
          ))}
        </div>
      ))}
    </div>
  );
}
