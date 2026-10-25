import Link from 'next/link';
import type { ActionTarget, Diagnosis } from '../types';
import type { CellLook } from './coverage';
import { CoverageSwatch } from './marks';

/** 05 §2.8 add-on line; shown once whether or not the backend already put it in `extra`. */
export const MIXED_TONE = 'Answer tone is mixed';

/**
 * Diagnosis card (05 §2.8, 06 §5.9): full width, first card under the title. Left: the matrix cell of this
 * question on this platform; right: verdict, rule sentence, the page's only primary button.
 * The diagnosis (code / title / action / target) is computed by the backend — this component only renders it.
 */
export function DiagnosisCard({
  diagnosis,
  cell,
  platform,
  sentiment,
}: {
  diagnosis: Diagnosis;
  cell: CellLook;
  platform: string;
  sentiment: string;
}) {
  const extra = [...(diagnosis.extra ?? [])];
  if (sentiment === 'mixed' && !extra.includes(MIXED_TONE)) extra.push(MIXED_TONE);

  return (
    <section aria-labelledby="diagnosis-title" className="rounded-xl border border-line bg-surface-card p-5">
      <div className="flex items-start gap-4">
        <CoverageSwatch cell={cell} platform={platform} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-tertiary">Diagnosis</p>
          <h2 id="diagnosis-title" className="mt-0.5 text-xl font-semibold text-ink" data-code={diagnosis.code}>
            {diagnosis.title}
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">{diagnosis.action}</p>
          {extra.map((line) => (
            <p key={line} className="mt-1 text-sm font-medium text-warning">
              {line}
            </p>
          ))}
          {diagnosis.target && <TargetButton target={diagnosis.target} />}
        </div>
      </div>
    </section>
  );
}

/** Product-level target first (B1 decides); 'scenario' is a hand-kept topic mapping, so it says so. */
function TargetButton({ target }: { target: ActionTarget }) {
  const label = target.kind === 'generic' ? 'View products' : target.label.replace(/\s*[↗→]$/, '');
  return (
    <div className="mt-4">
      <Link
        href={target.href}
        className="focus-ring inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-brand-on transition-colors duration-[120ms] ease-out hover:bg-brand-hover"
      >
        {label}
        <span aria-hidden="true">&nbsp;↗</span>
      </Link>
      {target.kind === 'scenario' && <p className="mt-1 text-xs text-ink-tertiary">Manual mapping — see README</p>}
    </div>
  );
}

/** Loading placeholder with the card's final size (06 §5 通则: no layout jump). */
export function DiagnosisSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex animate-pulse items-start gap-4 rounded-xl border border-line bg-surface-card p-5 motion-reduce:animate-none">
      <div className="h-9 w-9 rounded-md bg-surface-sunken" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 rounded-md bg-surface-sunken" />
        <div className="h-6 w-40 rounded-md bg-surface-sunken" />
        <div className="h-4 w-2/3 rounded-md bg-surface-sunken" />
        <div className="h-9 w-48 rounded-md bg-surface-sunken" />
      </div>
    </div>
  );
}
