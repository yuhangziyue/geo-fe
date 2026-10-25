import { matrixCellLook, type MatrixCell } from '../types';

/** Minimal run shape — both `crossPlatform[]` items and a `Question` (via runOf) fit. */
export interface RunLike {
  mentioned: boolean;
  recommended: boolean;
}

/** The look of one cell: state + "2/2" | "1/2" | "M" | "✕" | "—" (MatrixCell vocabulary). */
export type CellLook = Pick<MatrixCell, 'state' | 'label'>;

/**
 * The detail page's replica of one matrix cell (06 §5.9): the runs of this question on one platform.
 * QuestionDetailV3 carries no MatrixCell, so this counts the `crossPlatform` runs and hands the counts to
 * `matrixCellLook` — the same five-state rule the backend matrix uses (tested in backend schema.test.ts).
 * Display only — the diagnosis itself always comes from the backend.
 */
export function cellOf(runs: readonly RunLike[]): CellLook {
  return matrixCellLook(
    runs.length,
    runs.filter((r) => r.recommended).length,
    runs.filter((r) => r.mentioned).length,
  );
}

/** One run on its own (cross-platform column swatch). */
export function runCellOf(run: RunLike): CellLook {
  return cellOf([run]);
}
