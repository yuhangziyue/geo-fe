# Frontend Engineering Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Backfilled after execution** (commit `be26b9e`). Steps are checked as done; "Evidence" lines record what was
> actually run. Frontend had no test runner yet, so frontend steps were verified by headless-browser walkthrough
> instead of failing tests — a deviation from TDD, closed later by the quality-infrastructure plan.

**Goal:** Make dashboard state, types and loading behavior consistent: URL-owned filters, backend-owned types, no stale UI, smaller chart bundle.

**Architecture:** Backend adds `facets` and exported response types; frontend reads filters from the URL, renders through `useApi` + `AsyncState`, lazy-loads a trimmed ECharts module.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, zod, ECharts 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-frontend-engineering-fixes-design.md`

## Global Constraints

- Backend stays free of `next/*`; `app/api/*/route.ts` only forwards.
- Existing API contracts only grow (new fields), never rename. *(Held for this plan; the data-modeling plan later broke two fields on purpose — see its Global Constraints.)*
- Filter keys in URLs: `platform`, `topic`, `mentioned`, `recommended`, `q`, `page`, `simulate`.
- Vendor reconciliation tests (`metrics.test.ts`) must keep passing unchanged. *(For this plan; the data-modeling plan relaxed the topic comparison to `toMatchObject` when topics gained `scenario`.)*

## Review Focus

1. Unknown value in the URL (`/dashboard?platform=Foo`) → the page shows the API's 400 as a readable Error with a way out, not a blank or a select stuck on a value it does not list.
2. Rapid filter switching → the last selection wins; an earlier slow response never overwrites a later one.
3. Error while refreshing over stale data → stale numbers disappear; the user is never shown old numbers as current.
4. `simulate` carried by drill-down links but dropped by header nav links → acceptable only if consistent and intentional.
5. Chart container resized while hidden (collapsed layout, tab switch) → chart redraws at the right size when visible.

---

### Task 1: Backend facets and exported response types

**Files:**
- Modify: `backend/src/dashboard/schema.ts`, `backend/src/dashboard/repo.ts`, `backend/src/dashboard/http.ts`
- Test: `backend/src/dashboard/http.test.ts`

**Interfaces:**
- Produces: `interface Facets { platforms: Platform[]; topics: string[] }`; `loadFacets(): Facets`;
  `SummaryResponse = SummaryDTO & { facets }`, `QuestionPageResponse`, `QuestionDetailResponse`, `InsightResponse`.

- [x] **Step 1: Write the failing test** — `returns facets from the full dataset, even when filtered or simulated empty`: filtered list → 5 platforms, 8 topics; `summary?platform=DeepSeek` → `platforms` names `['DeepSeek']` but `facets.platforms` length 5; `simulate=empty` → 8 topics.
- [x] **Step 2: Implement** `loadFacets()` over the full dataset (platforms in `PLATFORMS` order, topics sorted); add `facets` to summary, list and their `simulate=empty` bodies; bind every handler body with `satisfies <Response>`.
- [x] **Step 3: Verify** — `pnpm test` → 46 passed.

### Task 2: URL-owned overview filter, drill-down context, keyed insights

**Files:**
- Modify: `frontend/components/dashboard/Overview.tsx`, `frontend/components/dashboard/QuestionsExplorer.tsx`, `frontend/components/dashboard/types.ts`

**Interfaces:**
- Consumes: `Facets`, response types (Task 1).
- Produces: `questionsHref(search: Pick<URLSearchParams,'get'>, extra: Record<string,string>): string` — keeps `platform`, `simulate`.

- [x] **Step 1:** Replace `types.ts` with type-only re-exports from `@geo/backend/dashboard/schema`; delete `PLATFORMS`/`TOPICS`.
- [x] **Step 2:** Overview reads `platform` from `useSearchParams`, writes via `router.push`; selects list `facets.platforms` (falling back to the URL value before the first response).
- [x] **Step 3:** Chart clicks use `questionsHref`; `<InsightPanel key={`${platform}|${simulate}`}>`.
- [x] **Step 4: Verify** — `pnpm typecheck` clean. Evidence (headless browser, prod build): select DeepSeek → `?platform=DeepSeek`, KPI 46%; topic click → `?platform=DeepSeek&simulate=slow&topic=Retail+Analytics`, both selects set; insights 5 → switch platform → 0 items, button "Generate insights".

### Task 3: Keep previous data while refreshing

**Files:**
- Modify: `frontend/components/dashboard/useApi.ts`, `frontend/components/dashboard/AsyncState.tsx`, plus `refreshing` passed by Overview, QuestionsExplorer, QuestionDetailView

**Interfaces:**
- Produces: `ApiState<T>` with `refreshing: boolean` (true only when `status === 'ok'`); `AsyncState` prop `refreshing?: boolean`.

- [x] **Step 1:** On URL change: if current status is `ok`, set `refreshing: true` and keep data; else loading. Error replaces data.
- [x] **Step 2:** `AsyncState` wraps content in a div with `aria-busy` and `opacity-50 pointer-events-none` while refreshing.
- [x] **Step 3: Verify** — Evidence: `?simulate=slow`, switch platform; 500 ms later: 5 dimmed blocks, 0 skeletons, KPI still 71%; after load 46%.

### Task 4: Trimmed, lazily loaded ECharts

**Files:**
- Create: `frontend/components/dashboard/echarts.ts`
- Modify: `frontend/components/dashboard/EChart.tsx`

**Interfaces:**
- Produces: `echarts.ts` exports `init` after registering BarChart, LineChart, Grid, Tooltip, Legend, CanvasRenderer.

- [x] **Step 1:** Static named imports + registration in `echarts.ts`; `EChart` does `import('./echarts')`; latest option applied on init via a ref; `ResizeObserver` on the container, disconnected on unmount.
- [x] **Step 2: Verify** — build, gzip the chunk containing zrender. Baseline 1049 KB / 340 KB gz → 538 KB / 183 KB gz. *First attempt (`import('echarts/charts')`) measured no gain — barrel dynamic import is not tree-shaken.*
- [x] **Step 3: Commit** — `be26b9e fix(p1): URL-driven overview filter, typed API contract, lighter echarts`.
