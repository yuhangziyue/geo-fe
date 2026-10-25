# P1 v3 契约说明（T0 定稿 · 子代理必读）

> 定稿于分支 `p1-v3`，基线 44771ed。规则以 05 产品拆解书为准，视觉以 06 设计规格为准。
> 契约文件只归 T0。**发现签名不够用：停下报 NEEDS_CONTEXT，不要在自己的分支里改契约。**

## 1. 契约在哪

| 文件 | 内容 | 谁能改 |
|---|---|---|
| `backend/src/dashboard/schema.ts`（`P1 v3 contract` 分隔线以下） | 全部 v3 类型、zod schema、`INTENTS` / `INTENT_LABELS` / `OWNED_DOMAIN_DISCLAIMER`、URL 工具 `parseGlobalFilter` / `globalFilterHref` | T0 |
| `backend/src/dashboard/__fixtures__/truth.ts` | 单测唯一真值源（05 §0 + 计划 §A），`truth.test.ts` 会从 questions.json 重算校验 | T0 |
| `backend/src/dashboard/contract.test.ts` | 签名的类型断言；改签名会让 backend `tsc` 变红 | T0 |
| `backend/src/dashboard/insight.ts` 里的 `buildActions` / `factsForLlm` | 签名（stub 会 throw） | 签名 T0，实现 B2 |
| `backend/src/dashboard/llm/*.ts` | `claude` / `template` / `verify` / `dispatcher` / `mockProvider` / `prompts` 的签名（stub） | 签名 T0，实现 B2 |
| `frontend/components/dashboard/types.ts` | 前端类型的唯一入口（含 `OWNED_DOMAIN_DISCLAIMER` 等常量） | T0 |
| `frontend/components/dashboard/useGlobalFilter.ts`、`FilterBar.tsx` | 全局筛选 URL hook 与三下拉，已实现 | T0 |

## 2. e2 既定、不许改的东西

`PLATFORMS`、`OWNED_DOMAIN`、`QuestionSchema` 及其 `superRefine` 业务规则、`Question.prompt_id`、`pct()`（整数五成双）、
`applyFilter` / `metricRow` / `badness` / `promptCoverage` / `promptsToFix`、`isOwnedUrl`、RFC 9457 `problem()`、
`?simulate=slow|error|empty`（`shared/simulate.ts`）、facets 取自全量数据而不是筛选结果。
`SummaryResponse` / `InsightBodySchema` / `InsightResponse` 已标 `@deprecated`，由 B1 随旧接口一起删除。

## 3. 每个并行任务能依赖什么、不能依赖什么

**D0（设计 token）** 只依赖 06 设计规格，不依赖任何后端契约；不能改 `FilterBar.tsx`，它已经按 06 §6 用了 token 类名（`border-line-strong`、`border-brand`、`text-brand`、`text-ink-secondary`、`bg-surface-card`），D0 只要把这些 token 按 06 §3.6 的名字落进 Tailwind，筛选栏就会自动着色，名字一个都不能改。

**B1（指标与 HTTP）** 可以依赖 schema.ts 的全部 v3 类型、`truth.ts`、`globalFilterHref`（拼 `evidenceHref` 和下钻链接），以及 B2 函数的**签名**：`buildActions(questions, filter, topicScenarios)`、`factsForLlm(cards, summary)`、`dispatchSummary(mode, facts)`。B2 实现落地前这些函数调用会 throw，所以 B1 的 http 测试必须 `vi.mock('./insight')` 和 `vi.mock('./llm/dispatcher')`。B1 不能碰 `insight.ts` / `insight.test.ts` / `llm/`；`postActionSummary` 只调 `dispatchSummary`，降级逻辑在 B2 的 dispatcher 里，不在 http.ts 里。`loadTopicScenarios()` 必须返回 `TopicScenarioMap`（`ReadonlyMap`），json 文件不存在时返回空 Map，不能返回 `{}`。

**B2（行动中心与 LLM）** 可以依赖 schema.ts 类型、`truth.ts`（测试里直接用真值构造 `LlmFacts`，不等 B1）、`globalFilterHref`、`isOwnedUrl`，`compareActionCards`（卡片唯一的排序规则）、`verificationOf`（回查分档唯一的规则），以及 `llm/claude.ts` 里已实现的 `DEFAULT_MODEL`、`resolveModel()`、`isLlmEnabled()`、`LlmTimeoutError`。B2 不能依赖 B1 的 aggregations 运行时输出，不能改 metrics / http / repo / schema；模型 ID 只能写在 `DEFAULT_MODEL` 这一处，测试里也只引用这个常量，不写字面量。`affectedQuestions` 按 schema.ts 里 `RULE_IDS` 上的逐条定义来算。

**F1（首页）** 可以依赖 `types.ts`（`Summary` = `SummaryV3Response`，`ActionCardsResponse`、`LlmSummaryResult`、`OWNED_DOMAIN_DISCLAIMER`、`INTENT_LABELS`、`INTENT_DISPLAY_ORDER`、`INTENT_TIERS_DISCLAIMER`、`SOURCE_TYPE_NOTE`）、`useGlobalFilter`、`<FilterBar facets={data?.facets ?? null} />`，以及第 4 节的接口形状。F1 不能直接 import `@geo/backend/*`，只走 `types.ts`；不能改 `FilterBar` / `useGlobalFilter`；不能在前端重算矩阵五态、排序或比率，后端给什么就画什么。

**F2（问题列表与详情）** 和 F1 一样只依赖 `types.ts`、`useGlobalFilter`、`FilterBar`；列表的响应仍然是 `QuestionPage`（带 `facets`），详情是 `QuestionDetailV3Response`，先判断 `question === null`（simulate=empty 时的空壳）再用 `diagnosis`；`diagnosis.target` 是 `ActionTarget`，`kind === 'scenario'` 时标「manual mapping」。F2 不能碰 F1 的目录，也不能碰契约文件。

## 4. 接口形状（B1 实现，F1/F2 消费）

| 方法 · 路径 | 参数 | 响应 |
|---|---|---|
| GET `/api/dashboard/summary` | `GlobalFilterSchema`（query） | `SummaryV3Response` = `SummaryV3DTO & { facets }` |
| GET `/api/dashboard/questions` | `QuestionQueryV3Schema`（query） | `QuestionPageResponse` |
| GET `/api/dashboard/questions/[id]` | — | `QuestionDetailV3Response` |
| GET `/api/dashboard/action-center/cards` | `GlobalFilterSchema`（query） | `ActionCardsResponse` |
| POST `/api/dashboard/action-center/summary` | `SummaryRequestSchema`（body） | `LlmSummaryResult`（永远 200，失败时降为 `mode:'rules'` 并写 `reason`） |

所有接口沿用 `?simulate=`；错误一律 `problem(status, title, detail)`；旧的 `/api/dashboard/insight` 由 B1 删除。

## 5. 几个容易踩的点

- **topic → scenario 可能是空的。** `TopicScenarioMap` 的取值有三种：取不到（json 被删或者新 topic）、`null`（故意不映射）、`ScenarioRef`。前两种都退回 `{ kind: 'generic', label: 'View products', href: '/products' }`；`kind: 'scenario'` 的落点在 UI 上必须标「manual mapping」。
- **URL 由一处生成。** 前端 `useGlobalFilter().buildHref`、后端 `evidenceHref`，都走 `globalFilterHref`，固定顺序 platform → topic → intent → extra；前端额外带上 `simulate`。不要各自手拼 query string。
- **F9 文案。** 凡是和自有信源有关的指标、卡片、行动卡，都显示 `OWNED_DOMAIN_DISCLAIMER`，不要自己另写一份。
- **矩阵不受 platform 筛选影响（I7）。** 矩阵只应用 topic 和 intent，永远 5 列，`stateCounts` 永远统计 5 列，所以「被筛掉」不会被算成「未监测」。有 platform 筛选时 `collapsedByDefault: true`，前端默认折叠并给展开按钮，不画单列矩阵。
- **比率字段都写明分母（I8）。** 漏斗每一段有 `rateOfAsked`（÷ 问题数）和 `rateOfPrevious`（÷ 上一段），`deltaPt` 只对应 `rateOfAsked`；问题数本身没有 delta。其他比率字段也用同样的后缀：`recommendationRateOfAsked`、`sourceBackedRateOfMentioned`、`shareOfCitations`、`LlmFacts.funnel.recommendRateOfAsked` / `recommendRateOfMentioned`。只有 `visibility` 不加后缀，它按 05 §1 的定义就是 提及数 ÷ 问题数。
- **证据数字带单位（C2）。** `EvidenceDatum = { label, value: number, unit: 'pct'|'pt'|'count', of? }`。前端按 `unit` 格式化，后端不往字符串里拼数字；verify 也按同一套单位比对。
- **摘要（I2–I4）。** 前端只看 `mode`（`'rules' | 'ai' | 'mock'`）选徽标，不比对模型 ID；`model` 只用来显示。`verification = { verified, total, band }`，分档规则只在 `verificationOf` 里：total=0 或全部核实记 `all`，核实率 < 50% 记 `low`（挂 low-verification 徽标），其余记 `partial`。不管哪一档，未核实的数字都按 `numbers[i].start/end` 在原文里标红。
- **行动卡排序（I5）。** 先按 severity，再按 `affectedQuestions` 降序，再按 `RULE_IDS` 的顺序；直接用 `compareActionCards`，不要自己写排序。
- **趋势空点（I6）。** 某天没有问题时 `dailyVisibility` 为 null（不画这个点）；窗口不满 7 天或窗口里没有问题时 `rollingVisibility` 为 null。`dailyN` 等于 4 只在不加筛选时成立。T-FIX 起每个点还带分子分母 `dailyMentions/dailyQuestions`、`rollingMentions/rollingQuestions`（都是 number，没数据时为 0），tooltip 用它们写 `Aug 4 · 4/4 mentioned (n=4)` 和 `7-day: 22/28 (79%)`；`dailyQuestions === dailyN`、`rollingQuestions === rollingN`。
- **矩阵格的最新日期与五态规则（T-FIX）。** `MatrixCell.latestDate` 是最新一次运行的日期（Not tracked 时为 null），tooltip 写 `Latest run <Mon D>`。五态判定只有一份实现：`matrixCellLook(n, recommended, mentioned)`（schema.ts，经 `types.ts` 导出），后端矩阵和详情页复刻格都调用它。
- **降级原因（T-FIX）。** `LlmSummaryResult.reason` 多了 `'unknown_provider'`：`LLM_PROVIDER` 写成未知值时报它，不再报 `no_api_key`。
- **意图层顺序。** `SummaryV3DTO.intents` 固定 4 行，按 `INTENT_DISPLAY_ORDER`（C → B → A → S）排列；ⓘ 文案用 `INTENT_TIERS_DISCLAIMER`。
- **真值。** 单测里的期望数字只从 `__fixtures__/truth.ts` import。`TRUTH_TOP_DOMAINS` 最后两个并列 7 条，顺序没有定义，不要断言它们的相对顺序。

## 6. 收尾自检（每个任务都要跑）

```bash
pnpm --dir <worktree> typecheck   # T-FIX 起同时检查 frontend 和 backend（含 contract.test.ts 的签名断言）
pnpm --dir <worktree> test
pnpm --dir <worktree> lint
```
