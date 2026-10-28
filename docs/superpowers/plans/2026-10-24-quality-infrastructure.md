# Quality Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Backfilled after execution** (commits `44771ed`, `dd41a4a`).

**Goal:** Close the remaining frontend-engineering gaps: a stuck-save bug, missing error boundaries, inaccessible charts, an oversized component, and no lint / e2e / CI.

**Architecture:** Lint and e2e live beside the code; e2e runs a production build fully isolated from `pnpm dev`; CI chains the existing commands.

**Tech Stack:** ESLint 9 + eslint-config-next 15.5.28, Playwright 1.58.2 (chromium), GitHub Actions, pnpm 7.33.7.

**Spec:** `docs/superpowers/specs/2026-10-24-quality-infrastructure-design.md`

## Global Constraints

- Never disturb a running `pnpm dev`: e2e uses port 3100, `NEXT_DIST_DIR=.next-e2e`, `GEO_DB_FILE=<abs>/.local/e2e.db`.
- Stop only processes you started (by port/PID), never by name pattern.
- Lint: zero warnings. Every disabled rule carries a reason on the line above.
- pnpm version is declared once, in `package.json#packageManager`, and must keep lockfile v5.4.

## Review Focus

1. Local `pnpm e2e` while a stale server already listens on 3100 → `reuseExistingServer` would test an old build; must not silently pass.
2. Save answered by a 4xx/5xx `application/problem+json` → the form shows its `detail`, re-enables the button (only the network-abort path is e2e-tested).
3. A render error inside a root layout → `global-error.tsx` shows; never exercised.
4. Overview under `?simulate=empty` after the split → every block still shows its own empty state (KpiRow must not receive empty `prompts`).
5. CI on a runner where Node ≠ local Node → `engines` says ≥18.18 but CI only runs 20.

---

### Task 1: ProductForm never hangs

**Files:** Modify `frontend/components/knowledge/ProductForm.tsx` · Test `e2e/knowledge.spec.ts`

- [x] **Step 1: Write the test** — `a failed save tells the user and does not leave the form stuck`: route `**/api/knowledge/products/**` aborted; expect text `/Network error: the change was not saved/`; Save button enabled.
- [x] **Step 2: Implement** — `try` around `fetch`; `res.json().catch(() => null)`; error when `!res.ok || !body?.slug`.
- [x] **Step 3: Verify both ways** — passes on new code; **fails on `HEAD:ProductForm.tsx`** (checked by swapping the file in and back).

### Task 2: Error and loading boundaries

**Files:** Create `frontend/app/(knowledge)/error.tsx`, `(knowledge)/loading.tsx`, `(dashboard)/dashboard/error.tsx`, `app/global-error.tsx`

- [x] **Step 1:** Knowledge error: `role="alert"`, Try again (`reset`) + "Browse all products"; digest shown when present. Dashboard error: crash-only message + Try again. Global error: own `<html>`, inline styles.
- [x] **Step 2: Verify** — `pnpm typecheck`, production build.

### Task 3: Split Overview and add chart data tables

**Files:** Create `frontend/components/dashboard/{charts.ts,KpiRow.tsx,IntentCards.tsx,links.ts}` · Modify `Overview.tsx`, `EChart.tsx` · Test `e2e/dashboard.spec.ts`

**Interfaces:**
- Produces: `interface ChartTable { caption: string; columns: string[]; rows: Array<Array<string | number>> }` (in `EChart.tsx`); `platformChart | trendChart | topicChart(data: Summary): { option: EChartsOption; table: ChartTable }`; `KpiRow({ data })`; `IntentCards({ data, hrefFor })`.

- [x] **Step 1: Write the test** — `each chart exposes its numbers as a table`: open "Show data table" in the topic card; 9 rows; Office Security row contains `53%`.
- [x] **Step 2: Implement** — `EChart` renders `<details>` + table (`caption.sr-only`, `th[scope]`), chart `aria-describedby` → table id (`useId`). Move builders and sub-components out; Overview spreads one `async` props object into every `AsyncState`. Overview 281 → 153 lines.

### Task 4: Lint, e2e, CI

**Files:** Create `frontend/eslint.config.mjs`, `playwright.config.ts`, `e2e/dashboard.spec.ts`, `e2e/knowledge.spec.ts`, `.github/workflows/ci.yml` · Modify `package.json`, `frontend/package.json`, `frontend/next.config.ts` (`distDir` from `NEXT_DIST_DIR`), `frontend/tsconfig.json` (include `.next-e2e/types`), `.gitignore`, `README.md`

- [x] **Step 1:** ESLint flat config; run; fix findings (rename echarts `use` → `registerModules`, drop dead `withSimulate` import, name default exports, justify the one cross-layout `<a>`). Verify: `pnpm lint` exit 0.
- [x] **Step 2:** Playwright config per Global Constraints; specs for spec cases 1–6. Use role + name-prefix locators for selects (a wrapping `<label>` names a select "Platform <option>"). Verify: `pnpm e2e` → 6 passed.
- [x] **Step 3:** CI workflow; `packageManager` in root `package.json`.
- [x] **Step 4: Commit** — `44771ed chore(quality): …`; push.
- [x] **Step 5: First CI run failed at install** — reproduce in a fresh clone with an empty store on Node 20: pnpm 7.18 → `ERR_INVALID_THIS` on every tarball. Pin `pnpm@7.33.7`; in the clean clone on Node 20 run install → typecheck → lint → test (57) → build → e2e with `CI=1` (6 passed). Commit `dd41a4a`.
