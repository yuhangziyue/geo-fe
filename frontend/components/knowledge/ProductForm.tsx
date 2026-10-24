'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProductInput, fieldErrors, type FieldErrors } from '@geo/backend/knowledge/schema';

type Values = {
  slug: string; name: string; seriesSlug: string; status: 'active' | 'beta'; shortDescription: string; overview: string;
  keyFeatures: string; bestFor: string; resolution: string; connectivity: string; environment: string; aiFeatures: string;
};

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function toInput(v: Values): unknown {
  return {
    slug: v.slug, name: v.name, seriesSlug: v.seriesSlug, status: v.status, shortDescription: v.shortDescription, overview: v.overview,
    keyFeatures: lines(v.keyFeatures), bestFor: lines(v.bestFor),
    specs: { resolution: v.resolution.trim() || null, connectivity: v.connectivity, environment: v.environment, aiFeatures: lines(v.aiFeatures) },
  };
}

export function ProductForm({
  mode, initial, series,
}: { mode: 'create' | 'edit'; initial: Values; series: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = toInput(v);
    const parsed = ProductInput.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus('error');
      setMessage('Please fix the highlighted fields.');
      return;
    }
    setStatus('saving');
    setErrors({});
    const res = await fetch(mode === 'create' ? '/api/knowledge/products' : `/api/knowledge/products/${initial.slug}`, {
      method: mode === 'create' ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json();
    if (!res.ok) {
      setErrors(body.errors ?? {});
      setStatus('error');
      setMessage(body.detail ?? body.title ?? 'Save failed');
      return;
    }
    setStatus('saved');
    setMessage('Saved. Product page and JSON-LD regenerated.');
    if (mode === 'create' || body.slug !== initial.slug) router.push(`/admin/products/${body.slug}/edit`);
    router.refresh();
  }

  const err = (k: string) => errors[k] ?? errors[`specs.${k}`];

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={err('name')}><input value={v.name} onChange={set('name')} className={input(err('name'))} /></Field>
        <Field label="Slug" error={err('slug')} hint="Lowercase, hyphens. Used in the URL."><input value={v.slug} onChange={set('slug')} className={input(err('slug'))} /></Field>
        <Field label="Series" error={err('seriesSlug')}>
          <select value={v.seriesSlug} onChange={set('seriesSlug')} className={input(err('seriesSlug'))}>
            <option value="">Select a series</option>
            {series.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Status" error={err('status')}>
          <select value={v.status} onChange={set('status')} className={input(err('status'))}>
            <option value="active">Active</option>
            <option value="beta">Beta</option>
          </select>
        </Field>
      </div>
      <Field label="Short description" error={err('shortDescription')}><input value={v.shortDescription} onChange={set('shortDescription')} className={input(err('shortDescription'))} /></Field>
      <Field label="Overview" error={err('overview')}><textarea rows={3} value={v.overview} onChange={set('overview')} className={input(err('overview'))} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Key features" hint="One per line" error={err('keyFeatures')}><textarea rows={4} value={v.keyFeatures} onChange={set('keyFeatures')} className={input(err('keyFeatures'))} /></Field>
        <Field label="Best for" hint="One per line. Exact scenario names get linked." error={err('bestFor')}><textarea rows={4} value={v.bestFor} onChange={set('bestFor')} className={input(err('bestFor'))} /></Field>
      </div>
      <fieldset className="grid gap-5 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Specs</legend>
        <Field label="Resolution" hint="Leave empty if not applicable" error={err('resolution')}><input value={v.resolution} onChange={set('resolution')} className={input(err('resolution'))} /></Field>
        <Field label="Connectivity" error={err('connectivity')}><input value={v.connectivity} onChange={set('connectivity')} className={input(err('connectivity'))} /></Field>
        <Field label="Environment" error={err('environment')}><input value={v.environment} onChange={set('environment')} className={input(err('environment'))} /></Field>
      </fieldset>
      <Field label="AI features" hint="One per line" error={err('aiFeatures')}><textarea rows={3} value={v.aiFeatures} onChange={set('aiFeatures')} className={input(err('aiFeatures'))} /></Field>

      <div className="flex items-center gap-4">
        <button disabled={status === 'saving'} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
          {status === 'saving' ? 'Saving...' : mode === 'create' ? 'Create product' : 'Save changes'}
        </button>
        {message && <p role="status" className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{message}</p>}
      </div>
    </form>
  );
}

const input = (error?: string) =>
  `mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${error ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`;

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {hint && <span className="ml-2 text-xs text-slate-400">{hint}</span>}
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const emptyValues: Values = {
  slug: '', name: '', seriesSlug: '', status: 'active', shortDescription: '', overview: '',
  keyFeatures: '', bestFor: '', resolution: '', connectivity: '', environment: '', aiFeatures: '',
};
