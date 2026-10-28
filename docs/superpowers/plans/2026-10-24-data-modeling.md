# Data Modeling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Backfilled after execution** (commit `f021ae9`). Backend tasks were test-first with values computed by script
> from `data/`; frontend tasks were verified in a headless browser.

**Goal:** Model prompts and runs, use intent, bridge topics to scenario pages, keep empty pages out of the index, and stamp only real edits.

**Architecture:** P1 derives `prompt_id` at load and computes prompt-level metrics in `metrics.ts`; a hand-curated `topic-scenario.ts` links P1 topics to P2 scenarios; P2 adds `updated_at` and per-scenario product counts.

**Tech Stack:** zod (`superRefine`), Drizzle + SQLite, Next.js metadata API, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-data-modeling-design.md`

## Global Constraints

- Do not change the meaning of any vendor field; derived fields are additive (`prompt_id`, `scenario`, `updatedAt`).
- Deliberate API breaks (the only consumer ships in the same commit): `crossPlatform` → `otherRuns` (it now includes the same platform on another day); `worstQuestions[]` items become prompts (`platform` → `platforms[]`, plus `promptId`, `badRuns`, `runs`). *(Recorded after review; the backfill first called every change additive.)*
- Never invent data: no seed-time `updated_at`, no meaning for intent letters, no fuzzy topic↔scenario matching.
- Vendor `dashboard_summary.json` must still reconcile (compare vendor fields with `toMatchObject`).
- Values pinned by the spec: coverage `{32,9,0}` / DeepSeek `{17,5,8}`; intents A 65 / B 80 / C 76; `missingIntents ["S"]`.

## Review Focus

1. `?intent=Z` (unknown intent) → should behave like an unknown platform (400), not silently return 0 rows.
2. Admin edits a product's Best For to exactly "Multi-site" → the scenario becomes non-empty and must enter sitemap / llms.txt and lose `noindex` after the save.
3. A new topic appears in the data with no map entry → it renders with `scenario: null`, never a crash; the repo test flags it.
4. Two prompts differing only by punctuation ("camera?" vs "camera") → treated as different prompts; normalization is case/whitespace only, by design.
5. `updatedAt` shown as `slice(0,10)` of a UTC ISO string → the date can be off by one for UTC+8 editors near midnight.

---

### Task 1: Prompt layer, business rules, intent and coverage metrics (backend)

**Files:**
- Modify: `backend/src/dashboard/schema.ts`, `repo.ts`, `metrics.ts`, `insight.ts`, `http.ts`
- Create: `backend/src/dashboard/topic-scenario.ts`, `backend/src/dashboard/repo.test.ts`
- Test: `metrics.test.ts`, `insight.test.ts`, `http.test.ts`

**Interfaces:**
- Produces: `promptId(text): string`; `parseQuestions(raw): Question[]` (`Question` has `prompt_id`);
  `topicScenario(topic): ScenarioRef | null`; `promptCoverage(rows): PromptCoverage`;
  `promptsToFix(rows, limit=5): PromptToFix[]`; `SummaryFilter.intent`; `Facets.intents`;
  `SummaryDTO.{prompts, intents, missingIntents, topics[].scenario, worstQuestions: PromptToFix[]}`;
  `QuestionDetailResponse.{otherRuns, analysis.topicScenario}`; `Insight.action?: {label, href}`;
  `TOPIC_SCENARIO: Record<string, string | null>`.

- [x] **Step 1: Write failing tests** — repo: 32 prompt ids, case/whitespace-insensitive; topic/intent constant per prompt; each of the 3 invariants throws a named message; every mapped slug exists and every data topic is a key. metrics: coverage `{32,9,0}` and DeepSeek `{17,5,8}`; intents exact rows; `missingIntents ["S"]`; `?intent=A` 60; Office → `{office, Office}`, Low-light → null; 5 distinct prompts, top `badRuns 3`, `[ChatGPT, DeepSeek]`, thermal-perimeter text. insight: order with `weak-intent` 3rd, text has `Intent A`, `65`, `39/60`; weak-topic action `/scenarios/office`. http: `?intent=A` total 60, `facets.intents [A,B,C]`, `otherRuns` excludes self.
- [x] **Step 2: Run** — `pnpm test` → failures as expected (missing exports / fields).
- [x] **Step 3: Implement** per the Interfaces block; ranking per spec A; `missingIntents = DOCUMENTED_INTENTS − present`.
- [x] **Step 4: Run** — `pnpm test` → 55 passed (one expected update: insights 5 → 6).

### Task 2: Scenario counts, honest `updatedAt`, `dateModified` (P2 backend)

**Files:**
- Modify: `backend/src/db/schema.ts` (column + DDL), `backend/src/knowledge/{schema,repo,jsonld}.ts`
- Test: `backend/src/knowledge/{repo,jsonld,http}.test.ts`

**Interfaces:**
- Produces: `ScenarioInfo.productCount: number`; `ProductDetail.updatedAt: string | null`.

- [x] **Step 1: Write failing tests** — `multi-site` count 0, warehouse count = its product list length; imported `updatedAt` null; JSON-LD of an imported product has no `dateModified`; after PUT, `updatedAt` within 60 s and equal to JSON-LD `dateModified`.
- [x] **Step 2: Implement** — `count(distinct product_id)` via left join; `updatedAt` set in `productValues` (create + update); spread `dateModified` only when set.
- [x] **Step 3: Run** — `pnpm test` → 57 passed.

### Task 3: Frontend surfaces

**Files:**
- Modify: `frontend/components/dashboard/{Overview,InsightPanel,QuestionsExplorer,QuestionDetailView}.tsx`, `frontend/app/sitemap.ts`, `frontend/app/llms.txt/route.ts`, `frontend/app/(knowledge)/scenarios/[slug]/page.tsx`, `frontend/app/(knowledge)/products/[slug]/page.tsx`

- [x] **Step 1:** Overview: "Prompt coverage" KPI, "Prompts to fix first" with platforms and `badRuns of runs`, "By intent type" cards linking `questionsHref(…,{intent})`, weakest-topic line linking the scenario page (plain `<a>`, other root layout).
- [x] **Step 2:** InsightPanel renders `action`; QuestionsExplorer adds the Intent select; detail shows "Where to improve" and "Other runs of this prompt".
- [x] **Step 3:** Empty scenario: noindex, no JSON-LD, filtered from sitemap / llms.txt / "Other scenarios"; product page shows "Last updated" when set.
- [x] **Step 4: Verify** — Evidence: KPI row `71% | 85 | 56 | 71 | 9/32`; weakest → `/scenarios/office`; Intent A card → 60 questions with select `A`; 6 insights incl. action link; question 1 other runs `ChatGPT, Gemini, Gemini`; curl: multi-site `noindex, follow`, sitemap 7 scenarios; PUT nova-x4 → `dateModified` + "Last updated".

### Task 4: README and commit

- [x] **Step 1:** README: P1 data model (ER + run/prompt facts), owned-by-domain rule, intent handling, topic→scenario principle, empty-scenario and `dateModified` policies; test count 57.
- [x] **Step 2: Commit** — `f021ae9 feat(model): prompt layer, intent analysis, topic→scenario bridge, honest dateModified`.
