'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AsyncState, Card } from '../AsyncState';
import type { Question, QuestionPage } from '../types';
import { useApi } from '../useApi';
import { useGlobalFilter } from '../useGlobalFilter';

/**
 * Words that never carry topic meaning in English questions: function words plus generic question
 * scaffolding ("best", "use", "need", …). Everything else (camera, warehouse, thermal, …) stays.
 */
const STOPWORDS = new Set<string>([
  'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'with',
  'without', 'via', 'per', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does',
  'did', 'done', 'doing', 'have', 'has', 'had', 'having', 'will', 'would', 'shall', 'should', 'can',
  'could', 'may', 'might', 'must', 'not', 'no', 'yes', 'so', 'than', 'then', 'this', 'that', 'these',
  'those', 'there', 'here', 'it', 'its', 'as', 'if', 'else', 'when', 'where', 'why', 'what', 'how',
  'which', 'who', 'whom', 'whose', 'about', 'above', 'after', 'before', 'between', 'during', 'into',
  'onto', 'over', 'under', 'from', 'up', 'down', 'out', 'off', 'also', 'just', 'only', 'more', 'most',
  'much', 'many', 'some', 'any', 'all', 'both', 'each', 'either', 'neither', 'other', 'another',
  'such', 'because', 'since', 'while', 'although', 'though', 'whether', 'own', 'your', 'my', 'our',
  'their', 'you', 'we', 'they', 'me', 'us', 'them', 'very', 'too', 'again', 'once', 'best', 'good',
  'great', 'better', 'works', 'work', 'working', 'use', 'used', 'using', 'get', 'gets', 'got',
  'help', 'helps', 'helpful', 'need', 'needs', 'needed', 'want', 'wants', 'like', 'look', 'looking',
  'make', 'makes', 'choose', 'choosing', 'well',
]);

export interface WordCount {
  word: string;
  count: number;
}

/** Lowercase tokens of one question text: split on non-letters, drop stopwords and words shorter than 3. */
export function tokenizeQuestion(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/**
 * Top `limit` words across the questions. The API returns one row per *run* of a prompt
 * (the same question is asked on several platforms), so rows are deduplicated by prompt_id
 * first — the cloud reflects the 32 unique questions, not how often each was run.
 */
export function countTopWords(questions: Question[], limit = 25): WordCount[] {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.prompt_id)) continue;
    seen.add(q.prompt_id);
    for (const word of tokenizeQuestion(q.question)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

const MIN_FONT_PX = 12;
const MAX_FONT_PX = 28;

/** Frequency rank → 12..28px, top word largest. */
function fontSizeForRank(rank: number, total: number): number {
  if (total <= 1) return MAX_FONT_PX;
  return Math.round(MAX_FONT_PX - (rank / (total - 1)) * (MAX_FONT_PX - MIN_FONT_PX));
}

/** Frequency rank → three bands of the design palette: brand → ink-secondary → ink-tertiary. */
function colorForRank(rank: number, total: number): string {
  const r = total <= 1 ? 0 : rank / (total - 1);
  if (r < 0.3) return 'text-brand';
  if (r < 0.65) return 'text-ink-secondary';
  return 'text-ink-tertiary';
}

const LINK_CLS = 'focus-ring rounded transition-colors duration-[120ms] ease-out hover:text-brand-hover';

/**
 * Word-cloud companion to the coverage matrix (task E): topic words of the questions AI covers.
 * Loads the question list under the current global filter (platform / topic / intent / range); click a word to
 * open the question list filtered by it, with every current filter carried along.
 */
export function CoverageWordCloud() {
  const { buildHref } = useGlobalFilter();
  const list = useApi<QuestionPage>(buildHref('/api/dashboard/questions', { pageSize: '100' }));
  const words = useMemo(() => (list.data ? countTopWords(list.data.items) : null), [list.data]);

  return (
    <Card
      title="Coverage word cloud"
      subtitle="Topic words of the questions AI covers · click a word to see its questions"
    >
      <AsyncState
        status={list.status}
        error={list.error}
        refreshing={list.refreshing}
        onRetry={list.retry}
        isEmpty={!!words && words.length === 0}
        skeletonHeight={180}
        skeleton={
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="rounded-md bg-surface-sunken" style={{ width: 52 + i * 14, height: 14 + i * 3 }} />
            ))}
          </div>
        }
        empty={<p>No questions to build a word cloud from.</p>}
      >
        {() => {
          const ws = words ?? [];
          return (
            <ul aria-label="Word cloud of the topics AI answers cover, most frequent first" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 py-2">
              {ws.map((w, rank) => (
                <li key={w.word}>
                  <Link
                    href={buildHref('/dashboard/questions', { q: w.word })}
                    className={`${colorForRank(rank, ws.length)} ${LINK_CLS}`}
                    style={{ fontSize: fontSizeForRank(rank, ws.length) }}
                    aria-label={`${w.word}, appears in ${w.count} question${w.count === 1 ? '' : 's'}`}
                  >
                    {w.word}
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </AsyncState>
    </Card>
  );
}
