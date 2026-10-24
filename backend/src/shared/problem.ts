// RFC 9457 problem details.
export function problem(status: number, title: string, detail?: string): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title, status, ...(detail ? { detail } : {}) }),
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}
