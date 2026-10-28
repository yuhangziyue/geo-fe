# Data Modeling — Design

> **Backfilled.** Written after the work shipped in `f021ae9`, from the session record. No spec existed before
> execution. Includes a factual error made during the review and how it was caught.

## Context

Review of the data-modeling axis. P2 (Knowledge Center) models faithfully: `best_for` keeps the original label and
links to a scenario only on an exact name match (nullable FK). P1 (dashboard) is a flat observation log: the domain's
core entity, the **prompt**, is missing, and P1↔P2 is linked only by product name.

## Data facts (verified by script against `data/`, not assumed)

- `questions.json`: 120 rows, **32 distinct question texts**, 3–4 rows each.
- **31 of 32 prompts repeat a platform on another day.** A row is therefore a *run* (prompt × platform × date),
  not "a prompt on one platform". *(The first review said "each asked once on 3–4 platforms" — wrong; caught when
  checking platform repeats before writing tests.)*
- Within a prompt, `topic` and `intent_type` are constant in 100% of cases → they are prompt attributes.
- Intents present: A 60 rows (39 mentioned → 65%), B 15 (80%), C 45 (34/45 → 76%). The data notes list S/A/B/C;
  **S has 0 rows**. Intent meanings are not defined anywhere.
- `source_type = Official`: 13 citations, **only 1** on `astervision.example`; the 7 owned-domain citations are
  split Industry 3 / Review 2 / Media 1 / Official 1. "Official" ≠ owned. *(Backfill first said "spread over
  Industry/Review/Media", omitting the 1 Official; corrected after review.)*
- Invariants hold in all 120 rows: recommended ⇒ mentioned; products named ⇒ mentioned;
  `citation_count == citations.length`.
- `best_for`: 15 labels, 7 match a scenario name exactly. Scenario *Multi-site* has **0** products (data says
  "Multi-site Deployment").
- Topics vs scenarios: 6 of 8 topics correspond to a scenario by meaning, none by exact name.
- Prompt coverage (every run mentions the brand): **9/32** overall, 0 never mentioned; DeepSeek only: 17 prompts,
  5 covered, 8 never mentioned.

## Design

**A. Prompt layer.** `prompt_id = "p_" + FNV-1a(lowercase, whitespace-collapsed, trimmed text)` as 8 hex digits,
derived at load time (`parseQuestions`). Other runs of a question are matched by `prompt_id`, not text equality.
`promptCoverage(rows) → { total, mentionedEverywhere, mentionedNowhere }`. "Prompts to fix first" holds one entry
per prompt, ranked by worst run (not mentioned > mentioned-not-recommended), then unmentioned-run count, then
short-run count, then id; each entry carries `platforms` of its worst runs, `badRuns`, `runs`.

**B. Intent as a dimension.** `intent` filter on summary, question list and insight bodies; summary `intents[]`
and `missingIntents` (documented S/A/B/C minus present); `facets.intents`; insight `weak-intent` whose text says
the dataset does not define intents ("a segment to inspect, not a cause").

**C. Topic → scenario bridge, hand-curated.** `TOPIC_SCENARIO: Record<topic, scenarioSlug | null>`; 6 mapped,
`Low-light Imaging` (a capability) and `Product Comparison` (a buying stage) explicitly `null`. Exposed as
`topics[].scenario`, `analysis.topicScenario`, and the weak-topic insight's `action` link.
*Principle (same as `best_for`): code never guesses a semantic merge; the content team owns the map.*

**D. Empty scenario pages stay out of the index.** `ScenarioInfo.productCount`; if 0: `robots: noindex, follow`,
no JSON-LD, excluded from sitemap, llms.txt and "Other scenarios"; visitor-facing copy.

**E. Honest freshness.** `product.updated_at TEXT NULL`, set to `new Date().toISOString()` on admin create/update
only. Imported rows stay `NULL`. JSON-LD `dateModified` and the page's "Last updated" appear only when set.
*Rejected:* stamping seed time — it would claim an edit that never happened.

**F. Business rules in the schema.** `QuestionSchema = shape.superRefine(...)` enforces the three invariants;
loading throws on drift.

**G. README** records the owned-by-domain rule and the P1 data model.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| Fuzzy topic↔scenario matching | decides for the data; violates "do not change field meaning" |
| `source_type = Official` as owned | 12/13 Official citations are third-party domains |
| A `prompt` table / DB for P1 | read-only 120 rows; a derived id gives the same model, contract unchanged |

## Acceptance criteria

1. 32 distinct `prompt_id`s; same text with different case/whitespace → same id.
2. `prompts` = `{32, 9, 0}` overall and `{17, 5, 8}` for DeepSeek.
3. Top "prompt to fix" is the thermal-perimeter prompt: `badRuns 3`, platforms `[ChatGPT, DeepSeek]`; 5 distinct prompts.
4. `intents` = A 60/65%/28 rec, B 15/80%/9, C 45/76%/19; `missingIntents = ["S"]`; `?intent=A` → 60 rows.
5. Office Security → `{slug: office, name: Office}`; Low-light Imaging → `null`; every mapped slug exists in `scenarios.json`; every data topic is a key of the map.
6. Six insights in order: weak-platform, weak-topic (with action `/scenarios/office`), weak-intent, mention-not-recommended, mentioned-not-cited, owned-sources.
7. `/scenarios/multi-site`: noindex, no JSON-LD, absent from sitemap and llms.txt.
8. Imported product: `updatedAt null`, no `dateModified`; after a PUT both present and equal.
9. Each broken invariant fails parsing with a message naming it.
10. Vendor `dashboard_summary.json` still reconciles field by field.
