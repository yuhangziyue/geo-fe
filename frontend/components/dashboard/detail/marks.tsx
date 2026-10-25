import { useId } from 'react';
import { INTENT_LABELS, INTENTS, type IntentTier, type MatrixState } from '../types';
import { CELL_STATE_NAME, type CellLook } from './coverage';

// Five coverage states (06 §3.3): one indigo hue by lightness + symbol + border form. Full class strings so Tailwind sees them.
const CELL_CLASS: Record<MatrixState, string> = {
  recommended: 'bg-cov-rec text-cov-rec-ink',
  partly: 'bg-cov-partly text-cov-partly-ink',
  mentioned_only: 'border border-cov-mentioned-line bg-cov-mentioned text-cov-mentioned-ink',
  not_mentioned: 'border-[1.5px] border-cov-none-line bg-cov-none text-cov-none-ink',
  not_tracked: 'cov-untracked text-cov-untracked-ink',
};

const SIZE = {
  /** 36×36 replica on the diagnosis card (06 §5.9) */
  lg: 'h-9 w-9 text-xs',
  /** 24×18 swatch on a cross-platform column (06 §5.10) */
  sm: 'h-[18px] w-6 text-xs leading-none',
} as const;

/** One coverage cell, matrix look. `platform` names it for screen readers: "ChatGPT: Recommended 2/2". */
export function CoverageSwatch({ cell, platform, size }: { cell: CellLook; platform: string; size: keyof typeof SIZE }) {
  const name = CELL_STATE_NAME[cell.state];
  const label = `${platform}: ${name}${cell.state === 'recommended' || cell.state === 'partly' ? ` ${cell.label}` : ''}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-semibold tabular-nums ${SIZE[size]} ${CELL_CLASS[cell.state]}`}
    >
      <span aria-hidden="true">{cell.label}</span>
    </span>
  );
}

const INTENT_CLASS: Record<IntentTier, string> = {
  C: 'bg-intent-c text-intent-c-ink',
  B: 'bg-intent-b text-intent-b-ink',
  A: 'bg-intent-a text-intent-a-ink',
  S: 'bg-intent-s text-intent-s-ink',
};

const isTier = (v: string): v is IntentTier => (INTENTS as readonly string[]).includes(v);

/**
 * 20×20 intent badge (06 §3.4). Unknown tiers render neutral; the data is never re-labelled.
 * `decorative`: the tier is already spelled out next to it, so the badge is hidden from screen readers.
 */
export function IntentBadge({ intent, decorative = false }: { intent: string; decorative?: boolean }) {
  const name = isTier(intent) ? `Intent ${intent} · ${INTENT_LABELS[intent].name}` : `Intent ${intent}`;
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': name, title: name };
  return (
    <span
      {...a11y}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isTier(intent) ? INTENT_CLASS[intent] : 'border border-line-strong text-ink-secondary'
      }`}
    >
      <span aria-hidden="true">{intent}</span>
    </span>
  );
}

/**
 * ⓘ that keyboard and screen-reader users can reach: a button described by its text, with a tooltip on hover
 * and on keyboard focus (06 §5.2 tooltip look: 12px, rounded-xl, shadow-md).
 */
export function InfoTip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        aria-describedby={id}
        className="peer focus-ring cursor-help rounded-full text-xs font-normal text-ink-tertiary hover:text-ink-secondary"
      >
        ⓘ
      </button>
      <span
        id={id}
        role="tooltip"
        className="invisible absolute left-1/2 top-full z-10 mt-1 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-line bg-surface-card p-2 text-left text-xs font-normal normal-case tracking-normal text-ink-secondary shadow-md peer-hover:visible peer-focus-visible:visible"
      >
        {text}
      </span>
    </span>
  );
}
