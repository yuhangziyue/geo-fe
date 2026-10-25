import { applyFilter } from '../metrics';
import {
  INTENTS,
  matrixCellLook,
  PLATFORMS,
  type GlobalFilter,
  type IntentTier,
  type MatrixCell,
  type MatrixDTO,
  type MatrixRow,
  type MatrixState,
  type Question,
} from '../schema';

/** Latest run first: later date, then higher id. */
const latest = (a: Question, b: Question) => b.date.localeCompare(a.date) || b.id - a.id;

/** One question × platform cell (05 §2.3). `runs` are that question's runs on that platform (0, 1 or 2). */
export function matrixCell(runs: Question[]): MatrixCell {
  const n = runs.length;
  const recommended = runs.filter((q) => q.brand_recommended).length;
  const mentioned = runs.filter((q) => q.brand_mentioned).length;
  const last = n > 0 ? [...runs].sort(latest)[0] : null;
  return {
    ...matrixCellLook(n, recommended, mentioned),
    n,
    recommended,
    mentioned,
    latestRunId: last?.id ?? null,
    latestDate: last?.date ?? null,
  };
}

/** Not mentioned × 2 + mentioned only × 1. */
export function gapScore(cells: MatrixCell[]): number {
  return cells.reduce((s, c) => s + (c.state === 'not_mentioned' ? 2 : c.state === 'mentioned_only' ? 1 : 0), 0);
}

/** gapScore desc, then question text asc (code-unit order, locale independent). */
export function compareMatrixRows(a: MatrixRow, b: MatrixRow): number {
  return b.gapScore - a.gapScore || (a.question < b.question ? -1 : a.question > b.question ? 1 : 0);
}

const asTier = (s: string): IntentTier | null => ((INTENTS as readonly string[]).includes(s) ? (s as IntentTier) : null);

/**
 * Question × platform matrix. Applies topic and intent only and IGNORES the platform filter (I7): always the 5
 * PLATFORMS columns, stateCounts over all 5; a platform filter only sets collapsedByDefault.
 */
export function buildMatrix(questions: Question[], filter: GlobalFilter): MatrixDTO {
  const rows = applyFilter(questions, { topic: filter.topic, intent: filter.intent });
  const byQuestion = new Map<string, Question[]>();
  for (const q of rows) byQuestion.set(q.question, [...(byQuestion.get(q.question) ?? []), q]);

  const stateCounts: Record<MatrixState, number> = { recommended: 0, partly: 0, mentioned_only: 0, not_mentioned: 0, not_tracked: 0 };
  const matrixRows: MatrixRow[] = [...byQuestion.entries()].map(([question, runs]) => {
    const cells = PLATFORMS.map((p) => matrixCell(runs.filter((q) => q.platform === p)));
    for (const c of cells) stateCounts[c.state] += 1;
    return { question, intent: asTier(runs[0].intent_type), topic: runs[0].topic, gapScore: gapScore(cells), cells };
  });

  return { platforms: PLATFORMS, rows: matrixRows.sort(compareMatrixRows), stateCounts, collapsedByDefault: Boolean(filter.platform) };
}
