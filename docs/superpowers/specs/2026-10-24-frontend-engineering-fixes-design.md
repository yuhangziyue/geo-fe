# Frontend Engineering Fixes — Design

> **Backfilled.** Written on 2026-10-24 *after* the work shipped in `be26b9e`, from the session record.
> No spec existed before execution; the plan was a table in chat. This document records what was decided and why,
> including what went wrong, so the code can be reviewed against it.

## Context

The exam weighs five things: frontend engineering, data modeling, interaction, API/data flow, AI product
understanding. A review of the frontend-engineering axis found the architecture strong (rendering chosen per
reader: CSR + `noindex` for the internal dashboard, SSG + on-demand revalidation for the crawler-facing Knowledge
Center) but the implementation inconsistent: one page kept filters in the URL, another in component state.

## Problems (evidence at review time, commit `0c65784`)

| # | Problem | Evidence | Severity |
|---|---|---|---|
| 1 | Overview drill-down drops the platform filter | `Overview.tsx` pushed `/dashboard/questions?topic=…` only | bug |
| 2 | AI Insight keeps showing results for a previous platform | `InsightPanel` state never reset on prop change | bug |
| 3 | Overview platform filter lives in `useState` | contradicts `QuestionsExplorer` (URL state); lost on refresh, not shareable | consistency |
| 4 | P1 response types hand-copied in the frontend | `types.ts` "mirrors backend"; P2 already imported backend types | drift risk |
| 5 | Every filter change collapses the page to skeletons | `useApi` reset `data` to `null` on each URL change | UX |
| 6 | Full `echarts` bundle; resize only on `window` | `import('echarts')`; `window.addEventListener('resize')` | perf |
| 7 | Platform / topic option lists hard-coded in the UI | `PLATFORMS`, `TOPICS` constants in `types.ts` | drift risk |

## Design

**D1. The URL is the only home of dashboard filter state.** Overview reads `?platform=` and writes it with
`router.push`. One helper builds drill-down links: `questionsHref(search, extra)` copies `platform` and `simulate`
from the current URL and adds the clicked dimension.

**D2. Stale insights are made impossible, not reset.** `InsightPanel` is rendered with
`key={`${platform}|${simulate}`}`; a filter change remounts it into the idle state.
*Rejected:* a `useEffect` that resets state on prop change — one extra render showing stale content, and easy to
forget when a new filter is added.

**D3. Refresh keeps the previous result on screen.** `useApi` state gains `refreshing: boolean`. When the URL
changes and data is already shown, status stays `ok` with `refreshing: true`; `AsyncState` dims the content
(`opacity-50`, `pointer-events-none`, `aria-busy`). Skeletons appear only on first load. An error drops the stale
data and shows the Error state.

**D4. The backend owns response types.** `backend/src/dashboard/schema.ts` exports `SummaryResponse`,
`QuestionPageResponse`, `QuestionDetailResponse`, `InsightResponse`, `Facets`; handlers bind each body with
`satisfies`. `frontend/components/dashboard/types.ts` becomes type-only re-exports.

**D5. Option lists come from the API.** Summary and question-list responses carry
`facets: { platforms, topics }`, computed from the **full** dataset (not the filtered rows), so a narrowed view
can still switch. Under `?simulate=empty` facets are still returned.

**D6. ECharts loads only what it draws.** A module `echarts.ts` statically imports `BarChart`, `LineChart`,
`Grid/Tooltip/Legend` components and `CanvasRenderer`, registers them, and exports `init`. `EChart.tsx`
lazy-loads that module. Resize follows the container via `ResizeObserver`.

## Rejected alternatives

| Alternative | Why not now | When |
|---|---|---|
| SWR / React Query | `useApi` (~40 lines) already handles races, retry and keep-previous-data; 4 endpoints | when cross-page caching or mutation invalidation is needed |
| Server Components for the dashboard first screen | D1 makes every view derivable from `searchParams`, so this becomes a move of the fetch, not a rewrite | next iteration |

## Acceptance criteria

1. Selecting DeepSeek on Overview yields URL `/dashboard?platform=DeepSeek`; refresh keeps it; KPI shows 46%.
2. Clicking a topic bar with DeepSeek selected lands on `/dashboard/questions?platform=DeepSeek&topic=…` with both selects set.
3. Generating insights, then changing platform, returns the panel to "Generate insights" with no stale list.
4. During `?simulate=slow` a platform change shows dimmed previous content and zero skeletons.
5. `tsc --noEmit` fails if a backend response field is renamed and the frontend still uses the old name.
6. Facets include all 5 platforms and 8 topics even when filtered to one platform or under `simulate=empty`.
7. The lazily loaded ECharts chunk is smaller than the full-bundle baseline (measured: 340 KB → 183 KB gzip).

## Out of scope

Frontend tests, lint and CI (see the quality-infrastructure design). Server Components migration.

## What went wrong during execution

- **First ECharts attempt did not shrink the bundle.** `import('echarts/charts')` (dynamic import of a barrel)
  is not tree-shaken; the chunk still contained map and sunburst code. Only measuring caught it; fixed by D6's
  static-import module.
- **The dev server was killed.** Cleaning up the test server with a broad `pkill -f next-server` also killed the
  user's `next dev` on :3000. Lesson: stop servers by the PID/port you started.
- **No spec before execution.** This document is the backfill.
