import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR } from '../shared/paths';
import { computeSummary } from './metrics';
import { loadQuestions } from './repo';

const questions = loadQuestions();
const reference = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'project1_dashboard', 'dashboard_summary.json'), 'utf8'),
);

describe('computeSummary', () => {
  const s = computeSummary(questions, {});

  it('computes the overall KPIs from question rows', () => {
    expect(s.kpi).toEqual({
      visibility: 71,
      mentions: 85,
      recommendations: 56,
      citations: 71,
      citedQuestions: 42,
      questions: 120,
    });
    expect(s.brand).toBe('AsterVision');
  });

  it('computes per-platform metrics', () => {
    const by = Object.fromEntries(s.platforms.map((p) => [p.name, p]));
    expect(by.Gemini.visibility).toBe(87);
    expect(by.DeepSeek.visibility).toBe(46);
    expect(by.Gemini.citations).toBe(10);
  });

  it('computes per-topic metrics', () => {
    const office = s.topics.find((t) => t.topic === 'Office Security');
    expect(office).toMatchObject({ visibility: 53, recommendations: 4, questions: 15 });
  });

  it('matches dashboard_summary.json item by item', () => {
    for (const ref of reference.platforms) {
      const p = s.platforms.find((x) => x.name === ref.name)!;
      expect(p).toMatchObject({
        visibility: ref.visibility,
        mentions: ref.mentions,
        recommendations: ref.recommendations,
        citations: ref.citations,
        questions: ref.question_count,
      });
    }
    expect(s.trend).toEqual(reference.trend);
    for (const ref of reference.topics) {
      expect(s.topics.find((t) => t.topic === ref.topic)).toEqual(ref);
    }
  });

  it('applies the platform filter', () => {
    const d = computeSummary(questions, { platform: 'DeepSeek' });
    expect(d.kpi.questions).toBe(24);
    expect(d.kpi.visibility).toBe(46);
  });

  it('lists 5 worst questions, unmentioned first', () => {
    expect(s.worstQuestions).toHaveLength(5);
    for (const w of s.worstQuestions) {
      expect(questions.find((q) => q.id === w.id)!.brand_mentioned).toBe(false);
    }
  });
});
