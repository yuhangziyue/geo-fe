/** Yes / no pill. Positive = `positive` on `positive-subtle`; negative = neutral, never red (a "no" is not an error). Owner: F1. */
export function StatusBadge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        ok ? 'bg-positive-subtle text-positive ring-positive/20' : 'bg-surface-sunken text-ink-secondary ring-line'
      }`}
    >
      {ok ? yes : no}
    </span>
  );
}
