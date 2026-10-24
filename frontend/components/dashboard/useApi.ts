'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * `refreshing` is true while a new URL loads on top of data we already show:
 * the previous result stays on screen (dimmed) instead of collapsing back to a skeleton.
 */
export type ApiState<T> =
  | { status: 'loading'; data: null; error: null; refreshing: false }
  | { status: 'error'; data: null; error: string; refreshing: false }
  | { status: 'ok'; data: T; error: null; refreshing: boolean };

/** Fetches JSON from our API; RFC 9457 problem bodies become readable error messages. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const title = body?.title ?? `Request failed (${res.status})`;
    throw new Error(body?.detail ? `${title}: ${body.detail}` : title);
  }
  return body as T;
}

export function useApi<T>(url: string | null): ApiState<T> & { retry: () => void } {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading', data: null, error: null, refreshing: false });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setState((prev) =>
      prev.status === 'ok'
        ? { ...prev, refreshing: true }
        : { status: 'loading', data: null, error: null, refreshing: false },
    );
    fetchJson<T>(url)
      .then((data) => alive && setState({ status: 'ok', data, error: null, refreshing: false }))
      .catch((e: Error) => alive && setState({ status: 'error', data: null, error: e.message, refreshing: false }));
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}

/** Adds the page's ?simulate= (demo of Loading / Error / Empty) to an API path. */
export function withSimulate(path: string, simulate: string | null): string {
  if (!simulate) return path;
  return `${path}${path.includes('?') ? '&' : '?'}simulate=${encodeURIComponent(simulate)}`;
}
