import { describe, expect, it } from 'vitest';
import { getQuestion, getSummary, listQuestions, postInsight } from './http';

const get = (path: string) => new Request(`http://localhost${path}`);

describe('dashboard http handlers', () => {
  it('rejects an unknown platform with 400 problem+json', async () => {
    const res = await listQuestions(get('/api/dashboard/questions?platform=Foo'));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect((await res.json()).status).toBe(400);
  });

  it('rejects page=-1 and mentioned=maybe with 400', async () => {
    expect((await listQuestions(get('/api/dashboard/questions?page=-1'))).status).toBe(400);
    expect((await listQuestions(get('/api/dashboard/questions?mentioned=maybe'))).status).toBe(400);
  });

  it('returns 404 for a missing question', async () => {
    const res = await getQuestion(get('/api/dashboard/questions/9999'), {
      params: Promise.resolve({ id: '9999' }),
    });
    expect(res.status).toBe(404);
  });

  it('filters by platform and mentioned', async () => {
    const res = await listQuestions(get('/api/dashboard/questions?platform=DeepSeek&mentioned=false'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(13);
    expect(body.pageSize).toBe(20);
  });

  it('returns question detail with analysis', async () => {
    const res = await getQuestion(get('/api/dashboard/questions/1'), {
      params: Promise.resolve({ id: '1' }),
    });
    const body = await res.json();
    expect(body.question.id).toBe(1);
    expect(body.analysis.products).toEqual([{ name: 'Nova PTZ 30', slug: expect.any(String) }]);
    // Other runs are matched by prompt, and include the same platform on another day.
    expect(body.otherRuns.length).toBeGreaterThan(0);
    for (const r of body.otherRuns) expect(r.id).not.toBe(1);
  });

  it('filters questions by intent and exposes intents as facets', async () => {
    const body = await (await listQuestions(get('/api/dashboard/questions?intent=A'))).json();
    expect(body.total).toBe(60);
    expect(body.facets.intents).toEqual(['A', 'B', 'C']);
  });

  it('serves the summary and the simulate modes', async () => {
    const ok = await (await getSummary(get('/api/dashboard/summary'))).json();
    expect(ok.kpi.visibility).toBe(71);
    expect((await getSummary(get('/api/dashboard/summary?simulate=error'))).status).toBe(500);
    const empty = await (await getSummary(get('/api/dashboard/summary?simulate=empty'))).json();
    expect(empty.kpi.questions).toBe(0);
    expect(empty.platforms).toEqual([]);
  });

  it('returns facets from the full dataset, even when filtered or simulated empty', async () => {
    const filtered = await (await listQuestions(get('/api/dashboard/questions?platform=DeepSeek'))).json();
    expect(filtered.facets.platforms).toEqual(['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'DeepSeek']);
    expect(filtered.facets.topics).toHaveLength(8);
    const summary = await (await getSummary(get('/api/dashboard/summary?platform=DeepSeek'))).json();
    expect(summary.platforms.map((p: { name: string }) => p.name)).toEqual(['DeepSeek']);
    expect(summary.facets.platforms).toHaveLength(5);
    const empty = await (await getSummary(get('/api/dashboard/summary?simulate=empty'))).json();
    expect(empty.facets.topics).toHaveLength(8);
  });

  it('builds insights over POST', async () => {
    const res = await postInsight(
      new Request('http://localhost/api/dashboard/insight', { method: 'POST', body: '{}' }),
    );
    expect((await res.json()).insights).toHaveLength(6);
  });
});
