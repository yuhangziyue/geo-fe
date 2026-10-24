import Link from 'next/link';
import type { Summary } from './types';

/** Visibility per intent type. Labels come from the dataset, which does not define them. */
export function IntentCards({ data, hrefFor }: { data: Summary; hrefFor: (intent: string) => string }) {
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-3">
        {data.intents.map((i) => (
          <li key={i.intent}>
            <Link href={hrefFor(i.intent)} className="block rounded-lg border border-slate-200 p-4 hover:border-indigo-300 hover:bg-slate-50">
              <p className="text-sm font-medium text-slate-500">Intent {i.intent}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{i.visibility}%</p>
              <p className="mt-1 text-xs text-slate-500">{i.questions} questions · {i.recommendations} recommendations</p>
            </Link>
          </li>
        ))}
      </ul>
      {data.missingIntents.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          The data notes also list intent {data.missingIntents.join(', ')}; no question in this selection has it.
        </p>
      )}
    </>
  );
}
