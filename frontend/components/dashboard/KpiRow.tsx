import type { SummaryV2 as Summary } from './types';

function KpiCard({ label, value, hint, sub }: { label: string; value: string; hint: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" title={hint}>
      <p className="flex items-center gap-1 text-sm font-medium text-slate-500">
        {label}
        <span aria-label={hint} className="cursor-help text-slate-400">ⓘ</span>
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub ?? hint}</p>
    </div>
  );
}

export function KpiRow({ data }: { data: Summary }) {
  const k = data.kpi;
  const citedPct = k.questions ? Math.round((k.citedQuestions / k.questions) * 100) : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard label="Visibility" value={`${k.visibility}%`} hint="Visibility = mention rate (questions mentioning the brand ÷ questions analyzed)" sub={`${k.mentions} of ${k.questions} questions mention the brand`} />
      <KpiCard label="Mentions" value={String(k.mentions)} hint="Questions whose answer mentions the brand" />
      <KpiCard label="Recommendations" value={String(k.recommendations)} hint="Questions whose answer recommends the brand" sub={`${k.mentions - k.recommendations} mentions without a recommendation`} />
      <KpiCard label="Citations" value={String(k.citations)} hint="Total cited sources across all answers" sub={`${k.citations} citations · ${k.citedQuestions} questions (${citedPct}%)`} />
      <KpiCard
        label="Prompt coverage"
        value={`${data.prompts.mentionedEverywhere}/${data.prompts.total}`}
        hint="Prompts whose every run (each platform, each day asked) mentions the brand. Rows are runs; content is written per prompt."
        sub={`prompts mentioned on every run · ${data.prompts.mentionedNowhere} never mentioned`}
      />
    </div>
  );
}
