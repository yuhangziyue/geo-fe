import type { MatrixState } from '../types';

/** Minimal run shape — both `crossPlatform[]` items and a `Question` (via runOf) fit. */
export interface RunLike {
  mentioned: boolean;
  recommended: boolean;
}

export interface CellLook {
  state: MatrixState;
  /** "2/2" | "1/2" | "M" | "✕" | "—", same vocabulary as MatrixCell.label */
  label: string;
}

/**
 * The detail page's replica of one matrix cell (06 §5.9): the runs of this question on one platform.
 * QuestionDetailV3 carries no MatrixCell, so the five-state look is derived from `crossPlatform` with the
 * MatrixCell vocabulary. Display only — the diagnosis itself always comes from the backend.
 */
export function cellOf(runs: readonly RunLike[]): CellLook {
  const n = runs.length;
  if (n === 0) return { state: 'not_tracked', label: '—' };
  const recommended = runs.filter((r) => r.recommended).length;
  if (recommended === n) return { state: 'recommended', label: `${recommended}/${n}` };
  if (recommended > 0) return { state: 'partly', label: `${recommended}/${n}` };
  if (runs.some((r) => r.mentioned)) return { state: 'mentioned_only', label: 'M' };
  return { state: 'not_mentioned', label: '✕' };
}

/** One run on its own (cross-platform column swatch). */
export function runCellOf(run: RunLike): CellLook {
  return cellOf([run]);
}

export const CELL_STATE_NAME: Record<MatrixState, string> = {
  recommended: 'Recommended',
  partly: 'Partly recommended',
  mentioned_only: 'Mentioned only',
  not_mentioned: 'Not mentioned',
  not_tracked: 'Not tracked',
};
