'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { AsyncState } from '../AsyncState';
import { InfoTip } from '../shared/InfoTip';
import { IntentBadge } from '../shared/marks';
import { FilterBar } from '../FilterBar';
import { INTENT_LABELS, INTENT_TIERS_DISCLAIMER, INTENTS, type IntentTier, type Question, type QuestionPage } from '../types';
import { useApi } from '../useApi';
import { useGlobalFilter } from '../useGlobalFilter';
import { readListParams, type ListParamKey } from './listParams';


const controlCls =
  'h-9 w-full rounded-md border bg-surface-card px-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand';
const secondaryBtn =
  'focus-ring inline-flex h-9 items-center rounded-md border border-line-strong bg-surface-card px-3 text-sm font-medium text-ink transition-colors duration-[120ms] ease-out hover:bg-surface-sunken';

const isTier = (v: string): v is IntentTier => (INTENTS as readonly string[]).includes(v);

/**
 * Question list (05 §2.9). Every filter lives in the URL: the global platform / topic / intent through
 * useGlobalFilter + FilterBar, the list-only mentioned / recommended / keyword / page next to them.
 */
export function QuestionsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { filter, buildHref } = useGlobalFilter();

  // mentioned / recommended / q / page — list-only, carried to the detail page and back.
  const listParams = readListParams(search);
  const listFilters: Record<string, string> = { ...listParams };
  delete listFilters.page;

  const apiHref = buildHref('/api/dashboard/questions', listParams);
  const list = useApi<QuestionPage>(apiHref);
  const data = list.data;

  // Keyword is typed locally and committed to the URL on submit.
  // Re-sync only when the committed keyword changes, so changing another filter keeps an unsubmitted draft.
  const committedQ = listParams.q ?? '';
  const [keyword, setKeyword] = useState(committedQ);
  useEffect(() => setKeyword(committedQ), [committedQ]);

  /** Sets list-only keys; keeps the global filter + simulate; a list change restarts from page 1 unless it is `page`. */
  const setList = (patch: Partial<Record<ListParamKey, string>>) => {
    const next: Record<string, string> = { ...listFilters };
    for (const [k, v] of Object.entries(patch)) {
      if (v) next[k] = v;
      else delete next[k];
    }
    router.push(buildHref(pathname, next), { scroll: 'page' in patch });
  };

  const clearAll = () => {
    const sim = search.get('simulate');
    router.push(sim ? `${pathname}?simulate=${encodeURIComponent(sim)}` : pathname, { scroll: false });
  };

  const hasFilters = Object.values(filter).some(Boolean) || Object.keys(listFilters).length > 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const detailHref = (id: number) => buildHref(`/dashboard/questions/${id}`, listParams);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Questions</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Every question asked to an AI assistant and how the brand showed up in the answer.
        </p>
      </div>

      {/* One filter region: the global dimensions and the list-only filters act on the same rows and share one
          URL, so they live in one card with one clear action ("Clear filters" clears both). */}
      <section aria-label="Question filters" className="rounded-xl border border-line bg-surface-card p-4">
        <FilterBar facets={data?.facets ?? null} range={data?.period ?? null} hideClearAll />
        <form
          className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setList({ q: keyword.trim() });
          }}
        >
          <YesNoSelect label="Mentioned" value={listParams.mentioned ?? ''} onChange={(v) => setList({ mentioned: v })} />
          <YesNoSelect label="Recommended" value={listParams.recommended ?? ''} onChange={(v) => setList({ recommended: v })} />
          <KeywordInput value={keyword} active={!!listParams.q} onChange={setKeyword} />
          <div className="flex gap-2">
            <button type="submit" className={secondaryBtn}>
              Search
            </button>
            {hasFilters && (
              <button type="button" onClick={clearAll} className="focus-ring h-9 rounded-md px-2 text-sm font-medium text-brand hover:text-brand-hover">
                Clear filters
              </button>
            )}
          </div>
        </form>
      </section>

      <section aria-label="Question list" className="rounded-xl border border-line bg-surface-card p-4">
        <AsyncState
          status={list.status}
          error={list.error}
          onRetry={list.retry}
          refreshing={list.refreshing}
          isEmpty={!!data && data.total === 0}
          skeletonHeight={300}
          empty={
            <>
              <p className="font-medium text-ink-secondary">No questions match these filters.</p>
              {hasFilters && (
                <button type="button" onClick={clearAll} className={`mt-2 ${secondaryBtn}`}>
                  Clear filters
                </button>
              )}
            </>
          }
        >
          {() => (
            <>
              <p className="mb-3 text-sm text-ink-tertiary tabular-nums">
                {data!.total} {data!.total === 1 ? 'question' : 'questions'}
              </p>
              <Table items={data!.items} detailHref={detailHref} />
              <Cards items={data!.items} detailHref={detailHref} />
              {pages > 1 && (
                <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-ink-tertiary tabular-nums">
                    Page {data!.page} of {pages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={data!.page <= 1}
                      onClick={() => setList({ page: String(data!.page - 1) })}
                      className={`${secondaryBtn} disabled:cursor-not-allowed disabled:text-ink-disabled`}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={data!.page >= pages}
                      onClick={() => setList({ page: String(data!.page + 1) })}
                      className={`${secondaryBtn} disabled:cursor-not-allowed disabled:text-ink-disabled`}
                    >
                      Next
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </AsyncState>
      </section>
    </div>
  );
}

function YesNo({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="font-medium text-ink">Yes</span>
  ) : (
    <span className="text-ink-tertiary">No</span>
  );
}

function IntentCell({ intent }: { intent: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <IntentBadge intent={intent} decorative />
      <span className="text-xs text-ink-secondary">
        <span className="sr-only">Intent {intent} · </span>
        {isTier(intent) ? INTENT_LABELS[intent].name : intent}
      </span>
    </span>
  );
}

/** ≥ md: the table, columns Question / Platform / Topic / Intent / Mentioned / Recommended / Citations. */
function Table({ items, detailHref }: { items: Question[]; detailHref: (id: number) => string }) {
  const th = 'py-2 pr-4 text-xs font-medium text-ink-secondary';
  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead className="border-b border-line">
        <tr>
          <th scope="col" className={th}>Question</th>
          <th scope="col" className={th}>Platform</th>
          <th scope="col" className={th}>Topic</th>
          <th scope="col" className={th}>
            <span className="inline-flex items-center gap-1">
              Intent <InfoTip text={INTENT_TIERS_DISCLAIMER} />
            </span>
          </th>
          <th scope="col" className={th}>Mentioned</th>
          <th scope="col" className={th}>Recommended</th>
          <th scope="col" className={`${th} pr-0 text-right`}>Citations</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.map((q) => (
          <tr key={q.id} className="align-top transition-colors duration-[120ms] ease-out hover:bg-surface-sunken">
            <td className="py-3 pr-4">
              <Link href={detailHref(q.id)} className="focus-ring rounded-md font-medium text-ink hover:text-brand hover:underline">
                {q.question}
              </Link>
              <div className="mt-0.5 text-xs text-ink-tertiary tabular-nums">{q.date}</div>
            </td>
            <td className="whitespace-nowrap py-3 pr-4 text-ink-secondary">{q.platform}</td>
            <td className="py-3 pr-4 text-ink-secondary">{q.topic}</td>
            <td className="whitespace-nowrap py-3 pr-4">
              <IntentCell intent={q.intent_type} />
            </td>
            <td className="py-3 pr-4"><YesNo ok={q.brand_mentioned} /></td>
            <td className="py-3 pr-4"><YesNo ok={q.brand_recommended} /></td>
            <td className="py-3 text-right tabular-nums text-ink">{q.citations.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** < md (375): one stacked card per question, no horizontal scroll. */
function Cards({ items, detailHref }: { items: Question[]; detailHref: (id: number) => string }) {
  return (
    <ul className="divide-y divide-line md:hidden">
      {items.map((q) => (
        <li key={q.id} className="py-3">
          <Link href={detailHref(q.id)} className="focus-ring rounded-md text-sm font-medium text-ink hover:text-brand hover:underline">
            {q.question}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-tertiary">
            <span>{q.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{q.topic}</span>
            <span aria-hidden="true">·</span>
            <IntentCell intent={q.intent_type} />
          </p>
          <dl className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-secondary">
            <div className="flex gap-1"><dt>Mentioned</dt><dd><YesNo ok={q.brand_mentioned} /></dd></div>
            <div className="flex gap-1"><dt>Recommended</dt><dd><YesNo ok={q.brand_recommended} /></dd></div>
            <div className="flex gap-1"><dt>Citations</dt><dd className="tabular-nums text-ink">{q.citations.length}</dd></div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function YesNoSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-1 sm:w-36">
      <label htmlFor={id} className="text-xs font-medium text-ink-secondary">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${controlCls} ${value ? 'border-brand' : 'border-line-strong'}`}>
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}

function KeywordInput({ value, active, onChange }: { value: string; active: boolean; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex w-full min-w-0 flex-col gap-1 sm:min-w-[220px] sm:flex-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-secondary">
        Keyword
      </label>
      <input
        id={id}
        type="search"
        placeholder="Search question, answer, product, source…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlCls} ${active ? 'border-brand' : 'border-line-strong'}`}
      />
    </div>
  );
}
