import { INTENT_LABELS, INTENTS, type IntentTier, type MatrixState } from '../types';

// The one definition of the coverage-cell look and the intent badge, used by the home matrix (F1) and the question
// detail / list pages (F2). Literal class strings so Tailwind generates them.

/** 06 §3.3: one hue, lighter = less AI presence; the hole is white with a dark 1.5px border; untracked is hatched. */
export const CELL_CLASS: Record<MatrixState, string> = {
  recommended: 'bg-cov-rec text-cov-rec-ink',
  partly: 'bg-cov-partly text-cov-partly-ink',
  mentioned_only: 'border border-cov-mentioned-line bg-cov-mentioned text-cov-mentioned-ink',
  not_mentioned: 'border-[1.5px] border-cov-none-line bg-cov-none text-cov-none-ink',
  not_tracked: 'cov-untracked text-cov-untracked-ink',
};

/** Display names of the five states. */
export const CELL_STATE_NAME: Record<MatrixState, string> = {
  recommended: 'Recommended',
  partly: 'Partly recommended',
  mentioned_only: 'Mentioned only',
  not_mentioned: 'Not mentioned',
  not_tracked: 'Not tracked',
};

const SWATCH_SIZE = {
  /** 36×36 replica on the diagnosis card (06 §5.9) */
  lg: 'h-9 w-9 text-xs',
  /** 24×18 swatch on a cross-platform column (06 §5.10) */
  sm: 'h-[18px] w-6 text-xs leading-none',
} as const;

/** One coverage cell outside the matrix, matrix look. `platform` names it for screen readers: "ChatGPT: Recommended 2/2". */
export function CoverageSwatch({
  cell,
  platform,
  size,
}: {
  cell: { state: MatrixState; label: string };
  platform: string;
  size: keyof typeof SWATCH_SIZE;
}) {
  const name = CELL_STATE_NAME[cell.state];
  const label = `${platform}: ${name}${cell.state === 'recommended' || cell.state === 'partly' ? ` ${cell.label}` : ''}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-semibold tabular-nums ${SWATCH_SIZE[size]} ${CELL_CLASS[cell.state]}`}
    >
      <span aria-hidden="true">{cell.label}</span>
    </span>
  );
}

/** 06 §3.4 intent badges (teal, ordered C → S). C is near-white, so it gets a ring to stay visible on a card. */
export const INTENT_BADGE_CLASS: Record<IntentTier, string> = {
  C: 'bg-intent-c text-intent-c-ink ring-1 ring-intent-b',
  B: 'bg-intent-b text-intent-b-ink',
  A: 'bg-intent-a text-intent-a-ink',
  S: 'bg-intent-s text-intent-s-ink',
};

const isTier = (v: string): v is IntentTier => (INTENTS as readonly string[]).includes(v);

/**
 * 20×20 intent badge (06 §3.4). `null` keeps the slot as an empty spacer (matrix rows stay aligned); a tier outside
 * S/A/B/C renders neutral — the data is never re-labelled. `decorative`: the tier is spelled out next to the badge,
 * so it is hidden from screen readers.
 */
export function IntentBadge({ intent, decorative = false, className = '' }: { intent: string | null; decorative?: boolean; className?: string }) {
  if (!intent) return <span aria-hidden="true" className={`inline-block h-5 w-5 shrink-0 ${className}`} />;
  const known = isTier(intent);
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': known ? `Intent ${intent}, ${INTENT_LABELS[intent].name}` : `Intent ${intent}`, title: known ? `Intent ${intent} · ${INTENT_LABELS[intent].name}` : `Intent ${intent}` };
  return (
    <span
      {...a11y}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-semibold ${
        known ? INTENT_BADGE_CLASS[intent] : 'border border-line-strong text-ink-secondary'
      } ${className}`}
    >
      <span aria-hidden="true">{intent}</span>
    </span>
  );
}
