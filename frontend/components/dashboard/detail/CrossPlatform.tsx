import Link from 'next/link';
import type { QuestionDetailV3 } from '../types';
import { runCellOf } from './coverage';
import { CoverageSwatch } from './marks';

type Run = QuestionDetailV3['crossPlatform'][number];

/**
 * Same question, every run, side by side (05 §2.8, 06 §5.10): platform + date, 24×18 coverage swatch, 3-line excerpt,
 * Open run. The current run is outlined in brand and not clickable. 4 columns at 1440 / 2 at 1024 / 1 at 375.
 */
export function CrossPlatform({
  runs,
  currentId,
  hrefFor,
}: {
  runs: QuestionDetailV3['crossPlatform'];
  currentId: number;
  /** detail link for another run, carrying the global filter + simulate */
  hrefFor: (id: number) => string;
}) {
  const platforms = [...new Set(runs.map((r) => r.platform))];
  return (
    <section aria-labelledby="cross-title" className="rounded-xl border border-line bg-surface-card p-5">
      <header className="mb-4">
        <h2 id="cross-title" className="text-base font-semibold text-ink">
          Across platforms
        </h2>
        <p className="mt-0.5 text-sm text-ink-tertiary">Answer excerpts from every run of this question, side by side</p>
      </header>
      {platforms.length === 1 && (
        <p className="mb-4 text-sm text-ink-secondary">This question was only asked on {platforms[0]}.</p>
      )}
      <ol className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {runs.map((run) => (
          <li key={run.id} className="min-w-0">
            <RunColumn run={run} current={run.id === currentId} href={hrefFor(run.id)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function RunColumn({ run, current, href }: { run: Run; current: boolean; href: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-ink-tertiary">
          {run.platform} · <span className="tabular-nums">{run.date}</span>
        </p>
        <CoverageSwatch cell={runCellOf(run)} platform={run.platform} size="sm" />
      </div>
      <p className="mt-2 line-clamp-3 text-sm text-ink-secondary">{run.answer_excerpt}</p>
    </>
  );

  if (current) {
    return (
      <div aria-current="page" className="flex h-full flex-col rounded-xl border-2 border-brand p-4">
        <span className="mb-2 self-start rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand-ink">This run</span>
        {body}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col rounded-xl border border-line p-4 transition-colors duration-[120ms] ease-out hover:border-line-strong">
      {body}
      <Link
        href={href}
        aria-label={`Open run on ${run.platform}, ${run.date}`}
        className="focus-ring mt-auto self-start rounded-md pt-3 text-sm font-medium text-brand hover:text-brand-hover hover:underline"
      >
        Open run
      </Link>
    </div>
  );
}
