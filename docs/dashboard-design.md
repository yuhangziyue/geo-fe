# 报表页设计思想（AI Visibility Dashboard · `/dashboard`）

> 用途：万悉前端岗笔试题交付物之一，录屏答辩「技术判断」环节的事实依据。
> 本文只描述**当前已实现**的设计，所有数字与行为均可回代码核实；第 6 节记录本轮产品评审意见对应的落地决策。

## 1. 一句话定位

报表页（`/dashboard`，Project 1 · AI Visibility Dashboard）是给「做 GEO 内容优化的人」看的**监测 → 诊断 → 行动**仪表盘，回答三个问题：AI 助手（ChatGPT / Gemini / Claude / Perplexity / DeepSeek）现在如何谈论品牌（提及 / 推荐 / 引用）；差距具体在哪一格（问题 × 平台）；下一步改什么（规则卡给出可回查证据的行动建议）。它不是数据罗列，而是「看完就知道该干什么」的决策页。

## 2. 页面信息架构

首页是「**两个视图、一个 Tab 切换**」（`?tab=insights`，默认 Data；状态在 URL，可分享、可后退）：

**Data 视图（看结果）**，自上而下：

1. 头部 + 全局筛选（Platform / Topic / Intent + 快捷回看窗口 All / Day / Week / Month）
2. Funnel（漏斗）
3. Matrix（AI 覆盖矩阵）
4. Coverage word cloud（覆盖问题词云）
5. Platforms（平台对比）| Trend（7 日趋势）
6. Topics（Topic 可见性）| Intents（意图分层）
7. Sources（信源）

**AI Insights 视图（给行动方向）**：Action Center（规则卡 + 可选 AI 执行摘要）独占一页——AI 内容不掩盖可复现的数字证据，要数字看 Data，要下一步改什么看 Insights。

信息层级是「**监测 → 诊断 → 行动**」的闭环，每个模块一句话职责 + 为什么在这个位置（Data 视图内）：

- **Funnel（漏斗）**：一个数字回答「整体在场感」——120 asked → 85 mentioned → 56 recommended。放第一：先给结论（整体可见性 71%），再谈细节。
- **Matrix（覆盖矩阵）**：32 问题 × 5 平台的五态热力图，回答「差距在哪一格」。紧跟漏斗：漏斗只回答整体，矩阵把整体拆到「问题 × 平台」的格子上，是诊断的入口。
- **Action Center（行动中心）**：7 条规则 + 可选 AI 执行摘要，回答「接下来改什么」。在 AI Insights 视图承接矩阵诊断：先看到白洞（问题），同一页 Tab 切换后给出可执行修复建议，每张卡的证据可回查。
- **Platforms（平台对比）**：各平台 Visibility / 推荐率 / 有出处率对比，回答「哪个平台拖后腿」（当前 DeepSeek 46% 最低）。从「改什么」回到「在哪个渠道改」，是空间维度的对比。
- **Trend（7 日趋势）**：7 日滚动可见性主线 + 日值散点，回答「在变好还是变坏」。与平台对比并排：平台是空间对比，趋势是时间对比。
- **Topics（Topic 可见性）**：各主题可见性，回答「哪个内容主题最弱」（当前 Office Security 53% 最低）。与平台/趋势并排在后半区，经 Topic → 场景映射可直接指到该改的场景页。
- **Intents（意图分层）**：C 认知 → B 方案 → A 评估 → S 决策的购买漏斗分层，回答「丢在哪一阶段」（S 层本期 0 题，以 Not tracked 占位而非 0%）。放在 Topics 之后：从「哪个主题」进一步到「哪个购买阶段」。
- **Sources（信源）**：自有信源占比 / source_type 分布 / Top 域名，回答「AI 引用谁的什么页面」。放在最末：这是诊断下钻材料，不是首要行动依据。

实现注：除行动中心单独请求自己的卡片接口外，其余模块共享同一个 `/api/dashboard/summary` 请求；每个模块各自持有 Loading / Empty / Error 状态（见 3.7）。

## 3. 核心设计思想逐条

以下各条提炼自 README §4「关键设计选择」并展开到代码事实，每条保持「为什么 / 反方 / 何时换」的结构。

### 3.1 指标一律由问题明细重算

- 所有指标从 `data/project1_dashboard/questions.json` 的 120 行明细按行重算（`backend/src/dashboard/metrics.ts`、`aggregations/*`），出题方的 `dashboard_summary.json` 只用来对账（`__fixtures__/truth.ts`，单测逐项比对）。
- 为什么：明细是唯一事实来源；数据源一旦换成真实明细，接口不用改。对账还真的抓到过差异：15/24 = 62.5，出题方汇总给 62，JS `Math.round` 会给 63（见 5 取整规则）。
- 反方：数据量小，直接读 summary 更省事。
- 何时换：明细到百万行以上时改为按天 / 平台 / Topic 预聚合，接口契约不变。

### 3.2 漏斗口径：120 → 85 → 56

- 行是观测：一行 = 一个 prompt 在一个平台上的一次运行（`Funnel.tsx` 的 Asked tip 原文）。嵌套三档：**120 asked → 85 mentioned（71%）→ 56 recommended（47%）**；两个非嵌套旁路指标：Source-backed 42/85（49%）、Owned source share 7/71（10%）。
- 为什么：三档嵌套回答「提及率 → 推荐率」的转化链；旁路指标明确不进入漏斗（有引用 ≠ 被推荐）。
- 口径细节：转换率 connector = 后一步 ÷ 前一步（Recommended ÷ Mentioned = 56/85 = 66%）；「最该优化」按最差一次观测排序（`metrics.ts` badness：未提及 2 > 提及未推荐 1 > 推荐 0）。
- 页面每个数字都可点击下钻到预置筛选的问题列表（如「35 not mentioned →」）。

### 3.3 覆盖矩阵五态编码：未监测 ≠ 从未被提及

- 32 问题 × 5 平台 = 160 格，每格是五态之一，判态只有一处实现（`backend/src/dashboard/schema.ts matrixCellLook`，前端详情页 `detail/coverage.ts` 复用）：
  - **Recommended**（全部运行均被推荐，格内标 r/n）
  - **Partly recommended**（部分提及且推荐，标 r/n）
  - **Mentioned only**（仅提及，标 M）
  - **Not mentioned**（从未被提及，标 ✕）
  - **Not tracked**（未监测，标 —）
- 编码原则：indigo 同色相按明度递减，**越深 = AI 越在场**；「越深 = 问题越大」的编码会误导——该改的是白洞（Not mentioned），不是深色格。
- 反方：红绿黄信号色更「直观」，但会把「未监测」和「表现差」混为一谈，且红绿对色觉障碍用户不友好。
- 细节：行按 gapScore 降序（未提及 ×2 + 仅提及 ×1，`aggregations/matrix.ts`）；默认 Top-12 + Show all；平台筛选时矩阵折叠（跨平台对比无意义，提示 + 展开按钮）；矩阵本身忽略平台筛选、始终 5 列（I7 裁决）。
- 何时换：问题数过百时默认只显示 Top-12（当前默认即 12 行）。

### 3.4 7 日滚动去噪

- 一天一个平台一问，单日 Visibility 只能是 0/25/50/75/100，毛刺全是假信号。主线用 **7 日窗口**（`aggregations/trend.ts` `WINDOW_DAYS = 7`，第 1–6 天窗口不完整 → 留空），日值只作淡色散点参考（`Trend.tsx`：scatter 系列、永不连线、无数据日为缺失而非 0% 点）。
- 为什么：0↔100 的抖动会误导「今天暴跌」的判断；窗口口径在 tooltip 里写清「7-day: 22/28 (79%)」。
- 反方：直接画日值折线信息更全。
- 何时换：单平台日问数上百（数据够密）时，日值本身有统计意义，可回到日线。

### 3.5 行动卡：阈值规则 + 数字可回查

- **7 条规则**（`schema.ts RULE_IDS`），阈值集中在 `insight.ts RULE_THRESHOLDS`：no-source-no-mention（≥5 条未提及且 ≥80% 无引用）、visibility-declining（后半期 − 前半期 ≤ −5pt 且两半各 ≥8 题）、weak-platform / weak-topic（最弱比总体低 ≥10pt）、mention-not-recommended（≥5 条）、owned-source-share（自有占比 <25% 且引用 ≥10 条）、decision-tier-untracked（S 层 0 题）。不达阈值不产卡。
- 每张卡：严重度（High / Medium / Low，4px 左边条）、finding、≤3 个结构化证据数字（后端按 unit 下发，前端格式化，数字从不写死在字符串里）、一条行动、证据链接（预置筛选的问题列表 URL）+ 行动目标（产品编辑页 → Topic 场景页 → `/products`）。
- **执行摘要三档**（`llm/dispatcher.ts`）：无 key → 确定性规则模板（徽标 Rules）；`LLM_PROVIDER=mock` → 固定演示摘要（徽标 Mock LLM (demo)，内含 1 个刻意写错的数字——DeepSeek 真实 46%，mock 写 31%——用于演示标红）；配 `ANTHROPIC_API_KEY` → Claude，**15 秒超时或失败自动降级模板**（`LLM_TIMEOUT_MS = 15_000`）。Generate 按钮在任何情况下都可用。
- **数字回查**（`llm/verify.ts`）：抽取摘要文本中每个数字（带单位 pct / pt / count）→ 与事实集按「数值 + 单位」比对（pct / pt 容差 ±1，count 精确）→ 未命中的在页面上标红（可聚焦、带说明）。规则模板 16/16 全过；AI 输出可能带红。
- **已知局限（R11）**：回查只按「数值 + 单位」比对，**不绑定具体事实路径**——「DeepSeek 19 mentions」可能因 ChatGPT 恰好也是 19 而被误判为 verified。下一步改为数字绑定 fact path 的结构化回查，**本版未实现**（README §4 ③ + §6 明确记录）。
- 反方：看起来没那么「AI」；但数字可复现、无 key 也能完整演示，评审不会看到模型编数字。
- 何时换：有真实 key 与稳定供应商后换评测过的模型；回查升级为结构化输出后关掉 mock 路径。

### 3.6 URL 即状态：筛选全在 URL

- 全局筛选（platform / topic / intent）只存在 URL 里（`useGlobalFilter` + `schema.ts globalFilterHref` / `parseGlobalFilter`）：刷新、分享、前进 / 后退都保留；`setFilter` 用 `router.push` 压历史记录、保留滚动、清掉列表分页页码。
- 所有下钻链接由 `buildHref` 生成，携带当前筛选 + `simulate` 透传（PASS_THROUGH）；行动卡的证据链接也是预置筛选的问题列表 URL。结论：「改筛选 → 看结果 → 把 URL 发给同事」成立，任何状态可分享、可回退、可复现。
- 反方：状态放组件内存写起来更简单，但刷新即丢。
- 边界：矩阵的「折叠 / 展开」「Show all」是局部 UI 状态，不进 URL（避免 URL 噪声）；趋势 x 轴锚定全周期（`periodDays` 取自全量数据），保证不同筛选下可比较。

### 3.7 三态（Loading / Error / Empty）与 a11y

- 每个数据块统一走 `AsyncState`（`frontend/components/dashboard/AsyncState.tsx`）：loading = 与终态同尺寸的骨架（无布局跳动，`motion-safe` 下禁脉冲）；error = `danger-subtle` 块 + Retry（RFC 9457 problem body 转可读错误）；empty = 一句结论 + 至多一个动作（如 Clear filters），不配插图。切筛选时已有数据保持显示并变暗（refreshing），不塌回骨架。
- **图表可访问性**（`frontend/components/dashboard/EChart.tsx`）：canvas 对读屏不透明、不可复制，因此每个 ECharts 容器带 `role="img"` + `aria-label` + `aria-describedby`，并附一张真实 HTML 表格（sr-only caption、`scope` 表头、tabular-nums），数字可复制、可被读屏朗读。Trend / Platforms / Topics 三张图都带数据表，经右上角 Chart / Table 分段切换（见 §6）。
- 矩阵是键盘可达的 HTML grid：行列 header 语义化，单元格 roving tabIndex（聚焦一格后方向键移动），每个格子 aria-label 带「平台 · 状态 · 推荐/提及计数 · 最近运行日期」。
- 颜色之外必有文本 / 形状冗余：五态 = 颜色 + 字符（r/n、M、✕、—）+ 图例计数；未验证数字标红同时带虚线、可聚焦、`aria-describedby` 说明。

## 4. 交互原则

### 4.1 `?simulate=` 演示开关

- `/dashboard?simulate=slow | error | empty` 可当场切出 Loading / Error / Empty 三态（`backend/src/shared/simulate.ts`；`DEMO_SIMULATE=0` 可关闭）：slow 为接口延迟，error 返回 500 RFC 9457 problem body，empty 返回空数据。
- 开关通过 URL 透传（`useApi.ts withSimulate` + `useGlobalFilter` PASS_THROUGH），任何下钻链接都带着它——评审可以全程在演示态下走完流程。
- 为什么：三态不是口头承诺，是能现场演示的；同时「URL 即状态」保证演示态本身可分享、可复现。

### 4.2 图表数据表格

- 见 3.7：每个 EChart 的右上角有 Chart / Table 分段切换（`EChart.tsx`，`aria-pressed`，默认 Chart）。表格是真实 HTML 数字表（可复制、可读屏）；表格与图表由同一份数据生成（`trendChart` / `platformChart` / `topicChart` 同时返回 option 和 table），不存在两套数字。图表 div 在表格视图下保持挂载（`hidden`），切换不会销毁 ECharts 实例。

### 4.3 focus-ring 与键盘可达

- 全局 `focus-ring` 类（可见 focus 环）用于所有链接 / 按钮 / 可聚焦元素；筛选 select 用 `focus-visible` outline。
- 矩阵为可键盘操作的 grid（roving tabIndex + 方向键）；未验证数字 `tabIndex={0}` 可聚焦；数据表格是普通 HTML `<table>`，键盘可直达、可复制。
- 语义化：区块用 `Card` + `aria-label`；severity 条、装饰条等 `aria-hidden`；IntentBadge 在文本相邻时对读屏隐藏，避免重复朗读。

## 5. 数据与口径表

所有数字可从 `data/project1_dashboard/questions.json` 与 `backend/src/dashboard/__fixtures__/truth.ts` 复核；百分比一律整数、四舍六入五成双。

| 指标 | 定义（分子 ÷ 分母） | 当前值（全量数据） |
|---|---|---|
| Visibility（提及率） | 被提及问题数 ÷ 问题数（行数） | 85/120 = **71%** |
| 推荐率（占 Asked） | 被推荐问题数 ÷ 问题数 | 56/120 = **47%** |
| 漏斗转换率（占 Mentioned） | 被推荐 ÷ 被提及 | 56/85 = 66% |
| Source-backed | 有 ≥1 条引用的问题数 ÷ 被提及数 | 42/85 = 49% |
| Owned source share | 自有域名引用条数 ÷ 全部引用条数 | 7/71 = 10% |
| Citations | 引用**条数**（非率） | 71 条；42 个问题有引用（35%） |
| 平台可见性 | 各平台被提及 ÷ 该平台问题数 | DeepSeek **46%** 最低（ChatGPT 76 / Gemini 87 / Claude 62 / Perplexity 83） |
| Topic 可见性 | 各主题被提及 ÷ 该主题问题数 | Office Security **53%** 最低（8 主题各 15 题） |
| 7 日滚动可见性 | 7 日窗口内被提及 ÷ 窗口内问题数 | 第 1–6 天无完整窗口 → 无值 |
| 半期变化（delta） | 后半期率 − 前半期率（pt） | 全量 -12pt；任一半 < 8 题 → null（Too few samples） |
| 意图分层 | 按购买漏斗 C / B / A / S | C 45 · B 15 · A 60 · **S 0**（无数据 → Not tracked 占位，不伪装 0%） |

- **取整规则**：整数运算的「四舍六入五成双」（`metrics.ts pct()`）。例：15/24 = 62.5 → 62（出题方汇总即 62；JS `Math.round` 会给 63，单测比对时发现）。85/120 = 70.83 → 71；56/120 = 46.67 → 47。
- **自有域名口径**：按域名判定（`isOwnedUrl`：`astervision.example`，**推断值**——P2 brand.json 写的是 `example.com/astervision`），不看 `source_type = Official`；13 条 Official 引用里只有 1 条在自有域名上。所有自有相关指标 / 卡片 / 行动卡带 ⓘ 声明，不冒充官方口径。
- **口径一致性**：漏斗 / 平台 / Topic / 意图 / 信源全部由同一份 `computeSummary(rows, filter)` 算出，一处定义处处生效；矩阵忽略平台筛选（I7），趋势轴锚定全周期（筛选只换窗口数据，不换坐标）。

行动卡阈值（`insight.ts RULE_THRESHOLDS`，全量数据下单测确认 7 张全触发，affected 数来自 `truth.ts TRUTH_ACTION_CARDS`）：

| 规则 | 触发条件 | 全量数据结果 |
|---|---|---|
| no-source-no-mention | 未提及 ≥5 条且其中 ≥80% 无引用 | High · 35 条 |
| visibility-declining | 后半期 − 前半期 ≤ −5pt，两半各 ≥8 题 | High · 21 条（-12pt） |
| weak-platform | 最弱平台可见性低于总体 ≥10pt | High · 13 条（DeepSeek 46% vs 71%） |
| mention-not-recommended | 提及但未推荐 ≥5 条 | Medium · 29 条 |
| owned-source-share | 自有占比 <25% 且引用 ≥10 条 | Medium · 35 条（10% / 71） |
| weak-topic | 最弱 Topic 低于总体 ≥10pt | Medium · 7 条（Office Security 53% vs 71%） |
| decision-tier-untracked | S 层 0 题（数据无 S） | Low · 0 条 |

## 6. 本轮产品评审新增的设计决策（已实现）

以下六条对应产品评审意见，逐条记录「意见 → 决策 → 实现」：

- **时间快捷筛选（日 / 周 / 月 / 季）**：`FilterBar` 新增 Range 分段控件（All / Day / Week / Month / Quarter）。决策：以数据末日为锚（数据是 2026-08-01~30，不锚「今天」），Day = 末日当天、Week = 末 7 天、Month = 末 30 天、Quarter = 末 90 天——30 天数据不够一季度，置灰并带 title 说明（`disabled` + tooltip，不是隐藏）。实现：`from`/`to` 成为全局筛选的一部分（`GlobalFilterSchema` + `GLOBAL_FILTER_KEYS`），四个接口（summary / questions / cards / summary POST）同窗口语义；趋势轴仍锚定全周期（筛选只换窗口数据），半期 delta 在窗口 < 8 题时自然回到「Too few samples」。URL 即状态：`?from=2026-08-24&to=2026-08-30` 可分享；"Clear all" 一并清掉窗口。
- **双 Tab（Data / AI Insights）**：`DashboardHome` 顶部 Tab 切换，状态在 URL（`?tab=insights`，Data 不写参数）。决策：数据视图 = 监测 + 诊断（漏斗 → 矩阵 → 词云 → 平台 | 趋势 → Topic | 意图 → 信源）；AI Insights 视图 = 行动方向（Action Center 独占）。AI 摘要与验证徽标留在 Insights 内，不混排进数字视图。实现：`useSearchParams` 读 / `router.push` 写，保留其它筛选参数；行动中心请求 key 含 `from`/`to`，换窗口不会残留旧摘要。
- **图表表格切换（右上角，默认图表）**：`EChart` 右上角 Chart / Table 分段按钮（`aria-pressed`，`role=group`），默认 Chart；表格视图保留原 HTML 表格的可复制与语义（caption / scope / tabular-nums / overflow-x-auto），图表 div 用 `hidden` 保持挂载，切换不重建 ECharts 实例。
- **词云（AI 覆盖了哪些问题）**：`CoverageWordCloud` 挂在 Matrix 之后，回答「AI 被问的是什么」——按 `prompt_id` 去重后对 32 个唯一问题做词频统计（避免同一问题跑 3–4 次放大词频），Top 25 词按排名映射字号 12–28px、三档品牌色。决策：它是矩阵的**辅助扫描视图**，不替代主口径（频率 ≠ 重要性，读不出未覆盖项）；点词下钻 `/dashboard/questions?q=<word>` 且携带当前全部筛选。
- **响应式底线（375px）**：两个真实溢出已修（顶栏品牌区折叠为 "AV" 徽标、产品页规格表格所在 grid 子项加 `min-w-0` 让表格在自己容器内滚动）；`e2e/responsive.spec.ts` 对 `/dashboard`、`/dashboard/questions`、`/products/nova-x4` 断言 375px 无横向溢出（另含 1024px 产品页）。Funnel 步骤标签在 375px 两行换行属正常，未改动。
- **报表页设计思想**：即本文档，作为录屏答辩「技术判断」环节的引用依据。

## 附录：本文数字来源（代码位置）

- 120 / 85 / 56、71%：`data/project1_dashboard/dashboard_summary.json`（questions_analyzed 120 / mentions 85 / visibility_score 71 / recommendations 56）；`backend/src/dashboard/__fixtures__/truth.ts` TRUTH_FUNNEL。
- DeepSeek 46%（最弱平台）：`dashboard_summary.json` platforms；`truth.ts` TRUTH_PLATFORMS（isWorst: true）。
- Office Security 53%（最弱 Topic）：`dashboard_summary.json` topics；`metrics.ts topicRows` 标记 isWorst。
- 7 日滚动：`backend/src/dashboard/aggregations/trend.ts`（WINDOW_DAYS = 7，前 6 天 null）；`frontend/components/dashboard/home/Trend.tsx`（日值散点、tooltip 口径）。
- 五态名称：`frontend/components/dashboard/shared/marks.tsx` CELL_STATE_NAME（Recommended / Partly recommended / Mentioned only / Not mentioned / Not tracked）；判态 `backend/src/dashboard/schema.ts matrixCellLook`。
- 行动卡规则与阈值：`backend/src/dashboard/schema.ts` RULE_IDS；`backend/src/dashboard/insight.ts` RULE_THRESHOLDS；全量 7 张卡的 affected 数 `truth.ts` TRUTH_ACTION_CARDS。
- 数字回查与 R11：`backend/src/dashboard/llm/verify.ts`（数值 + 单位比对，pct / pt 容差 ±1、count 精确）；README §4 ③、§6。
- mock 错误数字 31%（DeepSeek 真实 46%）：`backend/src/dashboard/llm/mockProvider.ts` MOCK_WRONG_PCT。
- 三态与 simulate：`backend/src/shared/simulate.ts`；`frontend/components/dashboard/AsyncState.tsx`；`frontend/components/dashboard/useApi.ts` withSimulate。
- URL 即状态：`frontend/components/dashboard/useGlobalFilter.ts`；`frontend/components/dashboard/FilterBar.tsx`；`backend/src/dashboard/schema.ts` globalFilterHref / parseGlobalFilter。
- 图表数据表：`frontend/components/dashboard/EChart.tsx`（role="img" + aria-describedby + Chart/Table 分段切换）。
- 首页顺序与模块职责：`frontend/components/dashboard/home/DashboardHome.tsx` 及各 home 组件头部注释。
