'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AsyncState } from '../AsyncState';
import type { QuestionDetailV3, QuestionDetailV3Response } from '../types';
import { useApi, withSimulate } from '../useApi';
import { readListParams } from '../list/listParams';
import { useGlobalFilter } from '../useGlobalFilter';
import { AnswerCard } from './AnswerCard';
import { cellOf } from './coverage';
import { CrossPlatform } from './CrossPlatform';
import { DiagnosisCard, DiagnosisSkeleton } from './Diagnosis';
import { IntentBadge } from '../shared/marks';

/** Question detail (05 §2.8): diagnosis card → this run's answer → every run side by side. */
export function QuestionDetail({ id }: { id: string }) {
  const search = useSearchParams();
  const simulate = search.get('simulate');
  const { buildHref } = useGlobalFilter();
  // mentioned / recommended / q / page came with us from the list; hand them back on every link out of here.
  const listParams = readListParams(search);
  const listHref = buildHref('/dashboard/questions', listParams);
  const detail = useApi<QuestionDetailV3Response>(withSimulate(`/api/dashboard/questions/${id}`, simulate));
  const d = detail.data;

  return (
    <div className="space-y-8">
      <Link href={listHref} className="focus-ring rounded-md text-sm text-ink-secondary hover:text-ink">
        ← All questions
      </Link>
      {detail.status === 'loading' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
            <div className="h-8 w-2/3 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />
          </div>
          <DiagnosisSkeleton />
        </div>
      ) : (
        <AsyncState
          status={detail.status}
          error={detail.error}
          onRetry={detail.retry}
          refreshing={detail.refreshing}
          isEmpty={!!d && d.question === null}
          empty={
            <>
              <p>No data for this question.</p>
              <Link
                href={listHref}
                className="focus-ring mt-2 inline-flex h-9 items-center rounded-md border border-line-strong bg-surface-card px-3 text-sm font-medium text-ink hover:bg-surface-sunken"
              >
                Back to questions
              </Link>
            </>
          }
        >
          {() => <Loaded data={d as QuestionDetailV3} hrefFor={(runId) => buildHref(`/dashboard/questions/${runId}`, listParams)} />}
        </AsyncState>
      )}
    </div>
  );
}

function Loaded({ data, hrefFor }: { data: QuestionDetailV3; hrefFor: (id: number) => string }) {
  const { question: q, diagnosis, crossPlatform, analysis } = data;
  // The matrix cell this run belongs to: every run of this question on this platform.
  const cell = cellOf(crossPlatform.filter((r) => r.platform === q.platform));
  return (
    <div className="space-y-6">
      <div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-tertiary">
          <span>{q.platform}</span>
          <span aria-hidden="true">·</span>
          <span>{q.topic}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{q.date}</span>
          <span aria-hidden="true">·</span>
          <IntentBadge intent={q.intent_type} />
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{q.question}</h1>
      </div>
      <DiagnosisCard diagnosis={diagnosis} cell={cell} platform={q.platform} sentiment={q.sentiment} />
      <AnswerCard question={q} analysis={analysis} current={true} />
      <CrossPlatform runs={crossPlatform} currentId={q.id} hrefFor={hrefFor} />
    </div>
  );
}
