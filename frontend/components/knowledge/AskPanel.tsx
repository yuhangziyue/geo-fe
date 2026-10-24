'use client';

import { useState } from 'react';

type Answer = { found: boolean; answer: string; conflict: boolean; sources: Array<{ label: string; href: string }> };

// Without a product the panel is site-wide (list page); on a product page it defaults to that product.
export function AskPanel({ productSlug, productName }: { productSlug?: string; productName?: string }) {
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<'product' | 'all'>(productSlug ? 'product' : 'all');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; data?: Answer; error?: string }>({ status: 'idle' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/knowledge/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, productSlug: scope === 'product' ? productSlug : undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? body.title ?? 'Request failed');
      setState({ status: 'done', data: body as Answer });
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Request failed' });
    }
  }

  const examples = productName
    ? [`Does ${productName} support PoE?`, `Does ${productName} support line crossing?`, `What scenarios is ${productName} best suited for?`]
    : ['Which products support thermal imaging?', 'Which products are best for warehouses?', 'Does Nova X8 support PoE?'];

  return (
    <section id="ask" aria-labelledby="ask-title" className="rounded-lg border border-sky-200 bg-sky-50/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ask-title" className="text-lg font-semibold">Ask AI</h2>
        {productName && (
        <div role="radiogroup" aria-label="Search scope" className="flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {(['product', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              onClick={() => setScope(s)}
              className={`rounded px-3 py-1 ${scope === s ? 'bg-sky-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {s === 'product' ? productName : 'All products'}
            </button>
          ))}
        </div>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">Answers come only from this knowledge base, with sources. Rule-based retrieval, English only.</p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Ask about ${scope === 'product' ? productName : 'any product'}...`}
          aria-label="Question"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <button disabled={state.status === 'loading'} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
          {state.status === 'loading' ? 'Asking...' : 'Ask'}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {examples.map((q) => (
          <button key={q} type="button" onClick={() => setQuestion(q)} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200 hover:ring-sky-300">
            {q}
          </button>
        ))}
      </div>

      {state.status === 'error' && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state.status === 'done' && state.data && (
        <div className="mt-4 rounded-md bg-white p-4 ring-1 ring-slate-200" aria-live="polite">
          {state.data.conflict && (
            <p className="mb-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Sources disagree</p>
          )}
          {!state.data.found && (
            <p className="mb-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Not found in knowledge base</p>
          )}
          <p className="text-sm text-slate-800">{state.data.answer}</p>
          {state.data.sources.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {state.data.sources.map((s) => (
                <li key={s.href + s.label}>
                  <a href={s.href} className="text-sky-700 underline underline-offset-2 hover:text-sky-900">Source: {s.label}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
