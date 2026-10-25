# Quality Infrastructure & Remaining Engineering Gaps — Design

> **Backfilled.** Written after the work shipped in `44771ed` (+ CI fix `dd41a4a`), from the session record.

## Problems

| # | Problem | Evidence | Severity |
|---|---|---|---|
| 1 | Admin save can hang on "Saving…" forever | `ProductForm` awaited `fetch` and `res.json()` outside `try` | bug |
| 2 | No frontend tests, no lint, no CI | no eslint config, no `.github`; a stray `eslint-disable` for a linter not installed | gap |
| 3 | No route-level `error.tsx` / `loading.tsx` | Knowledge Center SSR errors fell to Next's default page | consistency |
| 4 | Charts unreadable by screen readers | canvas + `aria-label` only | a11y |
| 5 | `Overview.tsx` at 281 lines | three chart configs, KPIs, intents, drill-down in one file | maintainability |

## Design

1. **ProductForm**: network failure → message "Network error: the change was not saved…"; non-JSON body parsed
   as `null`; any non-OK or slug-less body → error state with `detail`/`title`/status. The button is re-enabled on
   every failure path.
2. **Quality gates**
   - ESLint 9 flat config: `next/core-web-vitals` + `next/typescript`, `--max-warnings 0`; ignores build output
     (`.next`, `.next-e2e`) and test reports.
   - Playwright smoke suite against a **production build** (on-demand regeneration only exists there), isolated
     from `pnpm dev`: port **3100**, `NEXT_DIST_DIR=.next-e2e`, `GEO_DB_FILE=.local/e2e.db`, re-seeded per run.
     `workers: 1` (one shared DB) and `reuseExistingServer: false` (so "fresh build + fresh seed" always holds).
     *(Shipped as `fullyParallel: false` + reuse outside CI; review showed neither guarantee held — fixed.)*
   - CI (GitHub Actions, Node 20): install → typecheck → lint → test → build → Playwright chromium → e2e;
     upload the HTML report on failure. pnpm version comes from `packageManager`.
3. **Boundaries**: `(knowledge)/error.tsx` + `loading.tsx`, `(dashboard)/dashboard/error.tsx`, root
   `global-error.tsx` (brings its own `<html>`). Dashboard data errors stay per block (Retry); `error.tsx` is for
   render crashes.
4. **Chart data tables**: `EChart` takes `table?: { caption, columns, rows }`; renders a `<details>` "Show data
   table" with `<caption>`, `th[scope]`, and links it from the chart via `aria-describedby`.
5. **Overview split**: `charts.ts` (pure `platformChart / trendChart / topicChart → { option, table }`),
   `KpiRow.tsx`, `IntentCards.tsx`, `links.ts` (`questionsHref`). Overview keeps the URL filter and the request.

## E2E cases (the suite is the acceptance criteria)

1. Loading / Error / Empty via `?simulate=slow|error|empty`.
2. Platform in URL; drill-down to `?platform=DeepSeek&intent=A`; Back restores the selection.
3. Topic chart's data table: 9 rows, Office Security 53%.
4. Admin save → static product page and its JSON-LD contain the new feature and `dateModified`.
5. A failed save shows the network message and re-enables the button. *(Verified to fail on the pre-fix code.)*
6. `/scenarios/multi-site` is `noindex`, has no JSON-LD, is absent from the sitemap.

## Decisions on things not done

Prettier, pre-commit hooks, Dependabot, Lighthouse CI, Sentry — not worth it for a one-person exam repo; CI already
gates the same checks. Recorded here so the omission is a decision, not an oversight.

## What went wrong during execution

- **The first real CI run failed** at `pnpm install --frozen-lockfile`. Cause: pnpm **7.18** on **Node 20**
  fails every tarball download with `ERR_INVALID_THIS`. It never showed locally because installs were served from
  a warm store. Reproduced with a fresh clone + empty store; fixed by pinning `pnpm@7.33.7` (same lockfile v5.4);
  the full CI sequence then passed in the clean clone on Node 20 *before* pushing again.
- ESLint's first run found 2 errors / 3 warnings in AI-written code (echarts `use` read as a React hook, a dead
  import); a separate dist dir made Next rewrite `tsconfig.json` and ESLint scan build output — both pre-declared.
- A `cd /tmp` in a shell command moved the session's working directory; reverted.

## Post-backfill review (2026-10-25)

An independent reviewer checked `0c65784..dd41a4a` against all three specs and plans: every acceptance criterion
passed; no Critical issues; three Important issues, all fixed with tests first:

| # | Finding | Fix |
|---|---|---|
| I-1 | Unknown `intent` / `topic` returned 200 with 0 rows (unknown `platform` returned 400) — a mistyped link looked like a real empty result | `intent: z.enum(DOCUMENTED_INTENTS)`; topic checked against the full dataset's facets in each handler → 400 problem+json |
| I-2 | With one platform selected, insights contradicted themselves ("DeepSeek is the weakest" and "has the highest visibility"); "weakest topic" could rest on 1 question | platform comparisons only with ≥2 platforms; weakest topic / intent only among groups of ≥3 questions |
| I-3 | Local e2e reused any server on :3100, skipping the fresh seed and build | `reuseExistingServer: false`; `workers: 1` (`fullyParallel: false` did not serialize files) |

Minor findings fixed: refresh-time dimming now also covers the header period and the "Weakest" line; doc facts
corrected (owned-citation split, deliberate API renames, e2e guarantees). Minor findings left open, by decision:
repeated alerts with a Retry that cannot help on a 400 (M-1); `simulate` not carried by every link (M-2);
UTC date slice for "Last updated" (M-5); a no-op save still stamps `updated_at` (M-6); CI runs only Node 20, builds
twice, backend and e2e files are not linted (M-7); no migration for an old `.local/geo.db` (M-8, re-seed covers
dev/build/demo); `worstQuestions` naming (M-10).
