import { describe, expect, it } from 'vitest';
import { TRUTH_MATRIX, TRUTH_TOPICS } from '../../__fixtures__/truth';
import { loadQuestions } from '../../repo';
import { PLATFORMS, type MatrixCell, type Question } from '../../schema';
import { buildMatrix, compareMatrixRows, gapScore, matrixCell } from '../matrix';

const all = loadQuestions();

/** A synthetic run: only the fields the matrix reads matter. */
const run = (id: number, date: string, mentioned: boolean, recommended: boolean): Question => ({
  ...all[0],
  id,
  date,
  brand_mentioned: mentioned,
  brand_recommended: recommended,
});

describe('matrixCell — the five states (05 §2.3)', () => {
  it('recommended: every run recommended → "r/n"', () => {
    expect(matrixCell([run(1, '2026-08-01', true, true), run(2, '2026-08-03', true, true)])).toEqual({
      state: 'recommended', n: 2, recommended: 2, mentioned: 2, label: '2/2', latestRunId: 2, latestDate: '2026-08-03',
    });
    expect(matrixCell([run(7, '2026-08-01', true, true)])).toMatchObject({ state: 'recommended', label: '1/1' });
  });

  it('partly: some but not all runs recommended → "r/n"', () => {
    expect(matrixCell([run(1, '2026-08-01', true, true), run(2, '2026-08-03', true, false)])).toMatchObject({
      state: 'partly', n: 2, recommended: 1, mentioned: 2, label: '1/2',
    });
  });

  it('mentioned_only: none recommended, at least one mentioned → "M"', () => {
    expect(matrixCell([run(1, '2026-08-01', false, false), run(2, '2026-08-03', true, false)])).toMatchObject({
      state: 'mentioned_only', recommended: 0, mentioned: 1, label: 'M',
    });
  });

  it('not_mentioned: no run mentions the brand → "✕"', () => {
    expect(matrixCell([run(1, '2026-08-01', false, false)])).toMatchObject({ state: 'not_mentioned', label: '✕', latestRunId: 1, latestDate: '2026-08-01' });
  });

  it('not_tracked: no run at all → "—", no click-through', () => {
    expect(matrixCell([])).toEqual({ state: 'not_tracked', n: 0, recommended: 0, mentioned: 0, label: '—', latestRunId: null, latestDate: null });
  });

  it('latestRunId is the latest date, then the highest id on the same date', () => {
    expect(matrixCell([run(9, '2026-08-05', true, true), run(3, '2026-08-20', true, true)])).toMatchObject({ latestRunId: 3, latestDate: '2026-08-20' });
    expect(matrixCell([run(4, '2026-08-20', true, true), run(8, '2026-08-20', true, true)]).latestRunId).toBe(8);
  });
});

describe('gapScore / compareMatrixRows', () => {
  const cell = (state: MatrixCell['state']): MatrixCell => ({ state, n: 1, recommended: 0, mentioned: 0, label: '', latestRunId: 1, latestDate: '2026-08-01' });

  it('counts not mentioned × 2 + mentioned only × 1; other states score nothing', () => {
    expect(gapScore([cell('not_mentioned'), cell('mentioned_only'), cell('recommended'), cell('partly'), cell('not_tracked')])).toBe(3);
    expect(gapScore([cell('not_tracked'), cell('not_tracked')])).toBe(0);
  });

  it('sorts gap score desc, then question text asc', () => {
    const r = (question: string, score: number) => ({ question, intent: null, topic: 't', gapScore: score, cells: [] });
    expect([r('b', 1), r('a', 1), r('c', 4)].sort(compareMatrixRows).map((x) => x.question)).toEqual(['c', 'a', 'b']);
  });
});

describe('buildMatrix on questions.json', () => {
  const m = buildMatrix(all, {});

  it('has one row per distinct question and five columns in PLATFORMS order', () => {
    expect(m.rows).toHaveLength(TRUTH_MATRIX.rows);
    expect(m.platforms).toEqual([...PLATFORMS]);
    for (const row of m.rows) expect(row.cells).toHaveLength(TRUTH_MATRIX.columns);
    expect(m.collapsedByDefault).toBe(false);
  });

  it('matches the state distribution (81 tracked, 79 not tracked)', () => {
    expect(m.stateCounts).toEqual(TRUTH_MATRIX.stateCounts);
    const tracked = m.rows.flatMap((r) => r.cells).filter((c) => c.state !== 'not_tracked');
    expect(tracked).toHaveLength(TRUTH_MATRIX.trackedCells);
  });

  it('matches runs per tracked cell', () => {
    const perCell: Record<number, number> = {};
    for (const c of m.rows.flatMap((r) => r.cells)) if (c.n > 0) perCell[c.n] = (perCell[c.n] ?? 0) + 1;
    expect(perCell).toEqual(TRUTH_MATRIX.runsPerCell);
  });

  it('puts the 12 biggest gaps first', () => {
    expect(m.rows.slice(0, TRUTH_MATRIX.defaultRows).map((r) => r.gapScore)).toEqual([...TRUTH_MATRIX.top12GapScores]);
    expect([...m.rows].sort(compareMatrixRows)).toEqual(m.rows);
  });

  it('every cell points at a real run of that question on that platform', () => {
    for (const row of m.rows) {
      row.cells.forEach((c, i) => {
        if (c.latestRunId === null) {
          expect(c.latestDate).toBeNull();
          return;
        }
        const q = all.find((x) => x.id === c.latestRunId)!;
        expect(q.question).toBe(row.question);
        expect(q.platform).toBe(PLATFORMS[i]);
        // latestDate is that run's date, and no run of the cell is later (for the "Latest run <Mon D>" tooltip)
        expect(c.latestDate).toBe(q.date);
        const runs = all.filter((x) => x.question === row.question && x.platform === PLATFORMS[i]);
        expect(runs.every((x) => x.date <= q.date)).toBe(true);
      });
    }
  });

  it('ignores the platform filter: still 5 columns and the same counts, but starts collapsed (I7)', () => {
    const d = buildMatrix(all, { platform: 'DeepSeek' });
    expect(d.platforms).toEqual([...PLATFORMS]);
    expect(d.stateCounts).toEqual(TRUTH_MATRIX.stateCounts);
    expect(d.rows).toEqual(m.rows);
    expect(d.collapsedByDefault).toBe(true);
  });

  it('applies the topic and intent filters', () => {
    const office = TRUTH_TOPICS.find((t) => t.isWorst)!.topic;
    const t = buildMatrix(all, { topic: office });
    expect(t.rows.length).toBeGreaterThan(0);
    expect(t.rows.every((r) => r.topic === office)).toBe(true);
    expect(buildMatrix(all, { intent: 'S' }).rows).toEqual([]);
    expect(buildMatrix(all, { intent: 'A' }).rows.every((r) => r.intent === 'A')).toBe(true);
  });
});
