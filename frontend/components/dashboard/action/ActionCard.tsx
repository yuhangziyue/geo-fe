import Link from 'next/link';
import type { ActionCard as ActionCardData, EvidenceDatum, Severity } from '../types';

const SEVERITY: Record<Severity, { label: string; bar: string; text: string }> = {
  high: { label: 'High', bar: 'border-l-severity-high', text: 'text-danger' },
  medium: { label: 'Medium', bar: 'border-l-severity-medium', text: 'text-warning' },
  low: { label: 'Low', bar: 'border-l-severity-low', text: 'text-ink-tertiary' },
};

/** Formats an evidence number from its unit (the backend never bakes numbers into strings). */
export function formatEvidence(d: EvidenceDatum): { value: string; of: string | null } {
  if (d.unit === 'pct') return { value: `${d.value}%`, of: d.of !== undefined ? `of ${d.of}` : null };
  if (d.unit === 'pt') return { value: `${d.value < 0 ? '▼ ' : d.value > 0 ? '▲ ' : ''}${Math.abs(d.value)} pt`, of: null };
  return { value: d.of !== undefined ? `${d.value}/${d.of}` : String(d.value), of: null };
}

/**
 * One action card (05 §3, 06 §5.8): 4px severity bar, severity word + finding, ≤ 3 evidence numbers, one
 * imperative action, then two TEXT links (evidence · P2 target) — never buttons, one primary CTA per screen.
 */
export function ActionCard({ card }: { card: ActionCardData }) {
  const sev = SEVERITY[card.severity];
  return (
    <article className={`flex w-full min-w-0 flex-col gap-3 rounded-xl border border-l-4 border-line bg-surface-card p-4 ${sev.bar}`}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`text-xs font-semibold ${sev.text}`}>{sev.label}</span>
        <h3 className="min-w-0 text-base font-semibold text-ink">{card.finding}</h3>
      </header>

      {card.evidence.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {card.evidence.slice(0, 3).map((d) => {
            const f = formatEvidence(d);
            return (
              <div key={d.label} className="flex min-w-0 flex-col-reverse">
                <dt className="text-xs text-ink-tertiary">{d.label}</dt>
                <dd className="text-xl font-semibold tabular-nums text-ink">
                  {f.value}
                  {f.of && <span className="ml-1 text-xs font-normal text-ink-tertiary">{f.of}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      <div>
        <p className="text-sm text-ink-secondary">{card.action}</p>
        {/* F9: owned-source cards carry the domain assumption. */}
        {card.disclaimer && <p className="mt-1 text-xs text-ink-tertiary">ⓘ {card.disclaimer}</p>}
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link href={card.evidenceHref} className="focus-ring rounded-md text-ink-secondary hover:text-ink hover:underline">
          View evidence
        </Link>
        {card.target && (
          <span className="inline-flex flex-wrap items-baseline gap-x-1">
            {/* P2 is another root layout: a full page load either way, so a plain link (same tab, 06 §1 #12). */}
            <a href={card.target.href} className="focus-ring rounded-md font-medium text-brand hover:text-brand-hover hover:underline">
              {card.target.label} ↗
            </a>
            {card.target.kind === 'scenario' && <span className="text-xs text-ink-tertiary">manual mapping</span>}
          </span>
        )}
      </footer>
    </article>
  );
}
