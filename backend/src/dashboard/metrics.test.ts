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
      // topics also carry `scenario` (not in the vendor file), so compare the vendor's fields only.
      expect(s.topics.find((t) => t.topic === ref.topic)).toMatchObject(ref);
    }
  });

  it('applies the platform filter', () => {
    const d = computeSummary(questions, { platform: 'DeepSeek' });
    expect(d.kpi.questions).toBe(24);
    expect(d.kpi.visibility).toBe(46);
  });

  it('lists 5 prompts to fix, one entry per prompt, unmentioned first', () => {
    expect(s.worstQuestions).toHaveLength(5);
    expect(new Set(s.worstQuestions.map((w) => w.promptId)).size).toBe(5);
    for (const w of s.worstQuestions) {
      expect(questions.find((q) => q.id === w.id)!.brand_mentioned).toBe(false);
    }
    // 3 runs, all unmentioned, on ChatGPT and DeepSeek (DeepSeek twice): the worst prompt in the dataset.
    expect(s.worstQuestions[0]).toMatchObject({ badRuns: 3, platforms: ['ChatGPT', 'DeepSeek'] });
    expect(s.worstQuestions[0].question).toMatch(/^When should thermal cameras be used for perimeter/);
  });

  it('measures coverage per prompt, not per row', () => {
    expect(s.prompts).toEqual({ total: 32, mentionedEverywhere: 9, mentionedNowhere: 0 });
    expect(computeSummary(questions, { platform: 'DeepSeek' }).prompts).toEqual({ total: 17, mentionedEverywhere: 5, mentionedNowhere: 8 });
  });

  it('breaks visibility down by intent and reports documented intents with no data', () => {
    expect(s.intents).toEqual([
      { intent: 'A', questions: 60, visibility: 65, recommendations: 28 },
      { intent: 'B', questions: 15, visibility: 80, recommendations: 9 },
      { intent: 'C', questions: 45, visibility: 76, recommendations: 19 },
    ]);
    expect(s.missingIntents).toEqual(['S']);
    expect(computeSummary(questions, { intent: 'A' }).kpi.questions).toBe(60);
  });

  it('links topics to their scenario page only where curated', () => {
    expect(s.topics.find((t) => t.topic === 'Office Security')!.scenario).toEqual({ slug: 'office', name: 'Office' });
    expect(s.topics.find((t) => t.topic === 'Low-light Imaging')!.scenario).toBeNull();
  });
});
