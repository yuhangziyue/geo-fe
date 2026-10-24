/** Link into the question list that keeps the overview's context (platform, simulate) and adds the clicked dimension. */
export function questionsHref(search: Pick<URLSearchParams, 'get'>, extra: Record<string, string>): string {
  const next = new URLSearchParams();
  for (const k of ['platform', 'simulate']) {
    const v = search.get(k);
    if (v) next.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) next.set(k, v);
  return `/dashboard/questions?${next.toString()}`;
}
