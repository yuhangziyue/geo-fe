/**
 * List-only URL keys of the question list. platform / topic / intent belong to the global filter (useGlobalFilter);
 * these four travel next to it so list → detail → "All questions" lands on the same list view.
 */
export const LIST_PARAM_KEYS = ['mentioned', 'recommended', 'q', 'page'] as const;
export type ListParamKey = (typeof LIST_PARAM_KEYS)[number];

/** The list-only keys present in a URL, ready to pass as `extra` to useGlobalFilter().buildHref. */
export function readListParams(search: Pick<URLSearchParams, 'get'>): Partial<Record<ListParamKey, string>> {
  const out: Partial<Record<ListParamKey, string>> = {};
  for (const key of LIST_PARAM_KEYS) {
    const value = search.get(key);
    if (value) out[key] = value;
  }
  return out;
}
