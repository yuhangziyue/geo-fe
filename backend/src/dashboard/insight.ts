import { applyFilter, metricRow } from './metrics';
import { topicScenario } from './repo';
import { OWNED_DOMAIN, type Insight, type Question, type SummaryFilter } from './schema';

export const isOwnedUrl = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return host === OWNED_DOMAIN || host.endsWith(`.${OWNED_DOMAIN}`);
  } catch {
    return false;
  }
};

function href(filter: SummaryFilter, extra: Record<string, string>): string {
  const p = new URLSearchParams();
  if (filter.platform) p.set('platform', filter.platform);
  if (filter.topic) p.set('topic', filter.topic);
  if (filter.intent) p.set('intent', filter.intent);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return `/dashboard/questions?${p.toString()}`;
}

function groupMetrics(rows: Question[], key: (q: Question) => string) {
  const groups = new Map<string, Question[]>();
  for (const q of rows) groups.set(key(q), [...(groups.get(key(q)) ?? []), q]);
  return [...groups.entries()].map(([name, qs]) => ({ name, ...metricRow(qs) }));
}

/** Rule-based insights: every sentence is backed by a number recomputed from questions.json. */
export function buildInsights(questions: Question[], filter: SummaryFilter): Insight[] {
  const rows = applyFilter(questions, filter);
  if (rows.length === 0) return [];
  const all = metricRow(rows);
  const platforms = groupMetrics(rows, (q) => q.platform);
  const topics = groupMetrics(rows, (q) => q.topic);
  const out: Insight[] = [];

  const weakP = [...platforms].sort((a, b) => a.visibility - b.visibility)[0];
  out.push({
    id: 'weak-platform',
    title: `${weakP.name} is the weakest platform`,
    detail: `${weakP.name} mentions the brand in ${weakP.visibility}% of answers (${weakP.mentions}/${weakP.questions}), against ${all.visibility}% overall. Review the questions where it left the brand out.`,
    evidenceHref: href(filter, { platform: weakP.name, mentioned: 'false' }),
  });

  const weakT = [...topics].sort((a, b) => a.visibility - b.visibility)[0];
  const scenario = topicScenario(weakT.name);
  out.push({
    id: 'weak-topic',
    title: `${weakT.name} is the weakest topic`,
    detail: `Visibility on ${weakT.name} is ${weakT.visibility}% with only ${weakT.recommendations} recommendations out of ${weakT.questions} questions. ${
      scenario
        ? `Its content lives on the ${scenario.name} scenario page: strengthen that page and the products it lists.`
        : 'No scenario page covers this topic yet; it needs its own content.'
    }`,
    evidenceHref: href(filter, { topic: weakT.name, mentioned: 'false' }),
    action: scenario ? { label: `Open the ${scenario.name} scenario page`, href: `/scenarios/${scenario.slug}` } : undefined,
  });

  // Intent types are dataset labels without a definition: report the gap, do not explain it.
  const intents = groupMetrics(rows, (q) => q.intent_type);
  if (intents.length > 1) {
    const weakI = [...intents].sort((a, b) => a.visibility - b.visibility || a.name.localeCompare(b.name))[0];
    out.push({
      id: 'weak-intent',
      title: `Intent ${weakI.name} questions mention the brand least`,
      detail: `Intent ${weakI.name} covers ${weakI.questions} questions with ${weakI.visibility}% visibility (${weakI.mentions}/${weakI.questions}), against ${all.visibility}% overall. The dataset does not define intent types, so treat this as a segment to inspect, not a cause.`,
      evidenceHref: href(filter, { intent: weakI.name, mentioned: 'false' }),
    });
  }

  const notRec = all.mentions - all.recommendations;
  out.push({
    id: 'mention-not-recommended',
    title: `${notRec} mentions did not turn into a recommendation`,
    detail: `The brand was mentioned ${all.mentions} times but recommended only ${all.recommendations} times — ${notRec} answers name it without recommending it. These are the closest wins.`,
    evidenceHref: href(filter, { mentioned: 'true', recommended: 'false' }),
  });

  const topP = [...platforms].sort((a, b) => b.visibility - a.visibility || a.citations - b.citations)[0];
  out.push({
    id: 'mentioned-not-cited',
    title: `${topP.name} mentions the brand but rarely cites sources`,
    detail: `${topP.name} has the highest visibility (${topP.visibility}%) yet only ${topP.citations} citations across ${topP.questions} questions. Answers there are not grounded in linkable content.`,
    evidenceHref: href(filter, { platform: topP.name, mentioned: 'true' }),
  });

  const owned = rows.reduce((n, q) => n + q.citations.filter((c) => isOwnedUrl(c.url)).length, 0);
  out.push({
    id: 'owned-sources',
    title: 'Owned content is rarely cited',
    detail: `Only ${owned} of ${all.citations} citations point to ${OWNED_DOMAIN}; the rest come from third-party sites. Publishing structured product pages gives AI engines a first-party source.`,
    evidenceHref: href(filter, { q: OWNED_DOMAIN }),
  });

  return out;
}
