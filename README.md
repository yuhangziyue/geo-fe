# geo-fe · AI Visibility Dashboard + 产品知识中心

万悉科技 AI 全栈工程师（前端方向）笔试。两道题放在同一个仓库、同一个 Next.js 服务里，按访问路径区分：

| 应用 | 入口 | 对应 Trendee 能力 |
|---|---|---|
| Project 1 · AI Visibility Dashboard | `/dashboard` | GEO 监控系统：AI 可见性监控、AI 信源分析、智能行动中心 |
| Project 2 · 产品知识中心 | `/products`（后台 `/admin/products`） | GEO 原生网站基建：JSON-LD 结构化数据、内部知识图谱、问答式搜索、内部信息关联增强 |

> Demo 录屏：（待补链接）

---

## 1. 运行方式

环境：Node ≥ 18.18、pnpm。不需要任何 API key。

```bash
pnpm i
pnpm dev          # 自动 seed SQLite 后启动 http://localhost:3000
```

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发模式。先把 `data/` 里的 JSON 导入 SQLite（`.local/geo.db`），再起 Next.js |
| `pnpm demo` | seed → `next build` → `next start`。**演示「后台改内容 → 静态页与 JSON-LD 同步更新」请用这个**：dev 模式每次请求都现场渲染，看不出按需重新生成是否生效 |
| `pnpm test` | 单元测试（Vitest，backend 296 + frontend 11）：backend 全部领域逻辑，frontend 锁图表 option 的视觉红线 |
| `pnpm typecheck` | 前端 `tsc --noEmit` |
| `pnpm lint` | ESLint（`next/core-web-vitals` + `next/typescript`），零警告才通过 |
| `pnpm e2e` | Playwright 端到端测试（16 条）。自带生产构建，用独立的端口 3100、构建目录 `.next-e2e` 和数据库 `.local/e2e.db`，不影响正在跑的 `pnpm dev`。首次需 `pnpm exec playwright install chromium` |

CI（`.github/workflows/ci.yml`）依次跑 typecheck → lint → test → build → e2e，失败时上传 Playwright 报告。

**演示开关**：任一 Dashboard 页面加 `?simulate=slow | error | empty`，可当场切出 Loading / Error / Empty 三态（由 `DEMO_SIMULATE=0` 关闭）。

**better-sqlite3 装不上**：它是原生模块，常见平台有预编译包。若当前 Node 版本没有，会回退到本地编译（需要 Xcode Command Line Tools 或 build-essential）。seed 失败会打印原因并退出，不会静默。

---

## 2. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 15（App Router）· React 19 · TypeScript strict | Node 18 上限是 Next 15 |
| 样式 | Tailwind CSS 3.4 | |
| 组件 | antd 6（Tabs / Select / DatePicker / Card）+ @ant-design/nextjs-registry | Dashboard 的视图切换、维度筛选、自定义日期范围与卡片外壳走 antd 最佳实践；主题 token 对齐 `frontend/design/tokens.ts` |
| 可视化 | ECharts 5 | 只在客户端组件里加载，卸载时 dispose |
| 类型与校验 | zod | 数据文件、接口出入参、后台表单共用一份 schema |
| 存储 | P1：只读 JSON；P2：SQLite（better-sqlite3）+ Drizzle ORM | |
| 测试 | Vitest · Playwright | 单测断言值取自对数据的人工核算（backend 领域逻辑 + frontend 图表 option）；端到端覆盖三态、URL 筛选、后台保存后静态页与 JSON-LD 同步、保存失败、图表数据表、空场景不收录、375/1024 响应式无横向溢出 |

---

## 3. 项目结构

pnpm workspace，代码分前后端两个目录，**运行时只有一个 Next.js 进程**。

```
geo-fe/
├── data/                        出题方提供的 7 个 JSON，原样保留
├── backend/                     @geo/backend：纯 TypeScript，不起服务、不依赖 next/*
│   └── src/
│       ├── shared/              路径、RFC 9457 错误体、?simulate= 开关
│       ├── dashboard/           P1：schema · repo（读 JSON）· metrics · insight · http
│       ├── db/                  P2：Drizzle 表定义 · 连接 · seed
│       └── knowledge/           P2：schema · repo · jsonld · ask · http
└── frontend/                    唯一的 Next.js 应用
    ├── app/
    │   ├── (dashboard)/         前端应用一：自己的根布局，noindex
    │   ├── (knowledge)/         前端应用二：自己的根布局，/products、/scenarios、/admin
    │   ├── api/                 每个 route.ts 只转发到 backend/*/http.ts
    │   ├── sitemap.ts · robots.ts · llms.txt/
    └── components/{dashboard,knowledge}/
```

### 接口

| 接口 | 说明 |
|---|---|
| `GET /api/dashboard/summary?platform&topic&intent&from&to` | 漏斗 KPI（Asked→Mentioned→Recommended）、平台对比、7 日趋势、Topic、意图分层、覆盖矩阵、信源、平台 14 日趋势（`platformTrends`）；`from`/`to` 限定回看窗口（快捷筛选日 / 周 / 月） |
| `GET /api/dashboard/questions?platform&topic&intent&from&to&mentioned&recommended&q&page&pageSize` | 问题列表，服务端筛选与分页；附 `facets`（全量平台 / Topic / 意图） |
| `GET /api/dashboard/questions/:id` | 问题详情、跨平台对比、诊断（短板归因）、引用域名分组、提到的产品与对应场景页（链到 P2） |
| `GET /api/dashboard/action-center/cards` | 行动中心规则卡（随页加载；7 条规则） |
| `POST /api/dashboard/action-center/summary` | 执行摘要：`{mode:'ai'}` 按 provider 配置走 Claude 或 OpenAI 兼容端点（如 DeepSeek）、无 key 自动降级规则模板；`{mode:'rules'}` 强制模板。输出逐数字回查 |
| `GET /api/knowledge/products?series&scenario` · `GET /api/knowledge/products/:slug` | 产品列表与详情 |
| `POST /api/knowledge/products` · `PUT /api/knowledge/products/:slug` | 后台新增与编辑，成功后触发页面重新生成 |
| `POST /api/knowledge/ask` | Ask AI，body `{ question, productSlug? }` |

参数错误返回 400，资源不存在返回 404，错误体统一为 RFC 9457（`application/problem+json`）。

```bash
curl 'localhost:3000/api/dashboard/questions?platform=DeepSeek&mentioned=false'   # total: 13
curl 'localhost:3000/api/dashboard/questions?platform=Foo'                        # 400
curl -X POST localhost:3000/api/knowledge/ask -H 'content-type: application/json' \
  -d '{"question":"Does Nova X8 support PoE?","productSlug":"nova-x8"}'           # conflict: true
curl -X POST localhost:3000/api/dashboard/action-center/summary -H 'content-type: application/json' \
  -d '{"mode":"rules"}'                                                            # 16/16 numbers verified
```

### P1 数据模型

`questions.json` 的一行是一次**观测**（run）：某个 Prompt 在某个平台、某一天被问一次。120 行 = 32 个 Prompt × 3–4 次观测，其中 31 个 Prompt 有同一平台在不同日期被问两次。同一 Prompt 的 Topic 和意图 100% 一致，所以它们属于 Prompt。

```mermaid
erDiagram
  prompt ||--o{ run : "asked as (platform, date)"
  run ||--o{ citation : cites
  run }o--o{ product : "mentions (by name → P2 slug)"
  prompt }o--o| scenario : "topic → scenario (hand-curated)"
```

数据没有 Prompt id，`prompt_id` 由规范化后的问题文本哈希派生（[repo.ts](backend/src/dashboard/repo.ts)）。行内业务规则（推荐必先提及、提到产品必算提及、`citation_count` = 引用条数）写在 zod 的 `superRefine` 里，数据漂移会在加载时报错，不只校验形状。

v3 把「只看数」升级成「监测 → 诊断 → 行动」：首页第一层是嵌套漏斗 **Asked 120 → Mentioned 85（71%）→ Recommended 56（47%）**（行口径），其下是 32 个问题 × 5 平台的覆盖矩阵（五态，见设计选择 ⑧），行动中心（规则卡 + 执行摘要）是全页的「行动」出口。产品评审后的一次迭代把首页拆成两个视图（`?tab=insights` 切换，状态在 URL）：**Data（看结果）**= 漏斗 → 覆盖矩阵 → 覆盖问题词云 → 平台 | 趋势 → Topic | 意图 → 信源；**AI Insights（给行动方向）**= 行动中心。同时补了以数据末日为锚的快捷回看窗口（All / Day / Week / Month，季在 30 天数据里置灰）、每个图表的右上角 Chart / Table 切换（默认图表）和 375px 响应式底线（e2e 断言无横向溢出）。第二轮迭代（2026-10-28，设计评审见 [docs/design-review/](docs/design-review/) 与定稿 [docs/dashboard-design-optimization-v1.md](docs/dashboard-design-optimization-v1.md)）：筛选区下移重排（标题行 → 视图 Tab 行 → 筛选行）、**Custom 自定义时间范围**（popover 有界日期输入，改日期即写 URL）、趋势卡新增 **By: Overall | Attribution** 归因视图（半程 delta 排行表 + 100% 堆叠份额迁移图 + Intent A/C 7 日细分线，窗口 n≥8 才画线、样本不足不造线，排行每行带 View questions 直通问题列表）。同日 P1 档把 Overall 趋势整卡转为**深墨信号台**（`#0F172A` 底 + 纯 CSS 网格纹理 + 青色 3px 信号线——全站唯一粗线，对比度 9.88:1；右上「● LIVE · as of <数据末日>」是静态截止戳，不是实时流），Attribution 视图下新增 **5 平台 14 日滚动窗口小多图**（n≥8 才画线，tooltip 带窗口样本数；青 = time signal，与意图 teal 永不同轴）。实现取舍见 [docs/craft-notes.md](docs/craft-notes.md)，视觉样片：[趋势信号台桌面](docs/screenshots/trend-signal-console.png) · [移动端](docs/screenshots/trend-signal-console-mobile.png) · [平台小多图](docs/screenshots/platform-small-multiples.png)。设计思想与数字口径见 [docs/dashboard-design.md](docs/dashboard-design.md)。**两题的产品设计理念与架构总览见 [docs/design-architecture.html](docs/design-architecture.html)**（无外部依赖，浏览器直接打开）。

### P2 数据模型

```mermaid
erDiagram
  brand ||--o{ series : has
  series ||--o{ product : contains
  product ||--o{ product_feature : "key_features (ordered)"
  product ||--o{ product_ai_feature : "specs.ai_features"
  product ||--o{ faq : has
  product ||--o{ product_best_for : "best_for (original label)"
  scenario |o--o{ product_best_for : "linked on exact name match"
```

---

## 4. 关键设计选择

每条写清「为什么 / 反方 / 什么时候换」。

**① 一个服务，前后端分目录，两个前端应用按路径区分**
- 为什么：评审只跑一条命令；`backend/` 不依赖 Next，`app/api` 只是一层转发，边界靠目录和依赖方向守住。两个前端应用是两个路由组，各有自己的根布局，彼此不共享外壳。
- 反方：「后端」不是独立进程，扩缩容和发布绑在一起。
- 何时换：API 有 Next 以外的调用方，或需要独立发布时，把 `backend/*/http.ts` 挂到 Hono / Fastify 上即可，前端调用路径不变。

**② 指标一律由问题明细重算，summary 文件只用来对账**
- Visibility = 被提及的问题数 ÷ 问题数，即提及率，页面上直接写明；Citations 71 是引用**条数**，另外标出只有 42 个问题有引用（35%）。
- 取整用「四舍六入五成双」：Claude 15/24 = 62.5，出题方汇总是 62。用 JS `Math.round` 会得到 63，单测对出题方汇总逐项比对时发现。
- 行是观测，内容按 Prompt 改。v3 漏斗按行口径：**120 asked → 85 mentioned（71%）→ 56 recommended（47%）**；「最该优化」按最差一次观测排序。
- **自有来源按域名判定，不看 `source_type = Official`**：13 条 Official 引用里只有 1 条在 `astervision.example` 上；7 条自有域名引用分散在 Industry / Review / Media。Official 是数据方的来源类别，「是否自有」要另算，混用会把自有占比算错。⚠️ `astervision.example` 是推断的自有域名（P2 brand.json 写的是 `example.com/astervision`），凡自有信源相关指标 / 卡片 / 行动卡都带 ⓘ 声明，不冒充官方口径。
- 意图类型按业界购买漏斗定义：C 认知（45 题）→ B 方案（15 题）→ A 评估（60 题）→ S 决策（0 题）。S 层本期没有数据，页面渲染为「Not tracked」占位（斜线底），不伪装成 0%。
- 反方：数据量小，直接读 summary 更省事。但数据源一旦换成真实明细，接口不用改。
- 何时换：明细到百万行以上时，改为在数据库或 OLAP 里按天、平台、Topic 预聚合，接口契约不变。

**③ 行动中心：规则卡 + 执行摘要，数字全部可回查**
- 7 条规则（短板平台、短板 Topic、提及未转推荐、自有来源占比、可见性下滑、无来源无提及、S 层空白）都由明细算出，每条附一个可点开的证据链接（预置筛选的问题列表）。
- 执行摘要四态：无 key 返回确定性模板（徽标 Rules）；`LLM_PROVIDER=mock` 返回固定演示摘要（徽标 Mock LLM (demo)，内含 1 个刻意写错的数字用于演示标红）；配 `ANTHROPIC_API_KEY` 走 Claude，或配 `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` 走任意 OpenAI 兼容端点（默认 DeepSeek；变量名与题二 brand-writer 一致，`.env` 可直接复用）。provider 解析：`LLM_PROVIDER` 显式优先（拼错回落模板并注明 unknown_provider，缺自己的 key 报 no_api_key 不串路），未设置时按存在的 key 自动选择，双 key 并存确定走 Claude（向后兼容）。所有真实 provider 共用 15 秒超时与失败降级模板。Generate 按钮在任何情况下都可用。
- 摘要里的每个数字都回查事实集：抽取 → 按「数值 + 单位」比对 → 对不上的在页面上标红（可聚焦、带说明）。规则模板 16/16 全过；AI 输出可能带红。
- 已知局限（R11）：回查只按「数值 + 单位」比对，不绑定具体事实路径——「DeepSeek 19 mentions」可能因 ChatGPT 恰好也是 19 而被误判为 verified。下一步改为数字绑定 fact path 的结构化回查，本版未实现。
- 反方：看起来没那么「AI」；但数字可复现、无 key 也能完整演示，评审不会看到模型编数字。
- 何时换：有真实 key 与稳定供应商后，把 `ANTHROPIC_MODEL` 换成评测过的型号；回查升级为结构化输出后关掉 mock 路径。

**④ 产品页：静态生成 + 按需重新生成**
- 详情页和场景页用 `generateStaticParams` 预生成，后台保存后 `revalidatePath`。爬虫和 AI 抓取拿到的是完整 HTML。
- 反方：客户端渲染写起来更简单，但爬虫和 AI 读不到 JS 渲染的内容，等于这道题的立论不成立；另一个反方是「每次请求服务端渲染」，永远最新，但这类内容几乎不变，每次渲染是浪费。
- 何时换：产品数上万、一次编辑要重新生成的页面太多时，改为按标签（`revalidateTag`）精确失效，或加时间型 ISR 兜底。现在每次保存重新生成全部产品页（约 20 个），因为每个产品页都展示同系列产品。

**⑤ JSON-LD：一张 `@graph`，内容与页面可见内容同源，不编造**
- Organization（`@id`）、Product（`brand` 指向 Organization）、FAQPage、BreadcrumbList；场景页是 CollectionPage + ItemList。页面和 JSON-LD 由同一份数据渲染。
- **不补价格和评分**：数据里没有。Google 的 Product 富摘要需要 offers / review / aggregateRating 之一，所以 Rich Results Test 会对 Product 报缺字段。这里的 Product 标记用来**声明实体**，让 AI 系统理解「哪个品牌的哪款产品、有什么属性」，这正是 GEO 的价值所在。
- 反方：补一个 Mock 价格就能让 Rich Results Test 全绿。但结构化数据必须和页面可见内容一致，编造价格既违反 Google 的结构化数据政策，也违背「不改原始数据含义」。
- 何时换：有真实价格或评价数据时补上 `offers` / `aggregateRating`，争取富摘要。
- `dateModified` 同理：产品表有 `updated_at`，后台保存时写入，JSON-LD 和页面上的「Last updated」据此输出；导入的内容没有编辑时间，就不输出，不拿导入时间冒充修改时间。
- 校验实录：Schema Markup Validator 零错误（[全页](docs/screenshots/validator-product-jsonld.png) · [Product 节点详情](docs/screenshots/validator-product-jsonld-detail.png)）；Rich Results Test 的 Product 缺 `offers`/`review`/`aggregateRating` 报错照实留档，且该工具要求登录才给预览（[截图](docs/screenshots/rich-results-code-signin-required.png)），产品标记定位是 GEO 实体声明，不是争取富摘要。

**⑥ Ask AI：只依据知识库作答，资料冲突时明说**
- 关键词检索，「是否支持某功能」类问题优先查规格（数据里这类 FAQ 是答非所问的模板句）；查不到就明确说没有。
- 卖点与规格矛盾时两处都引用，提示「Sources disagree」，不替数据拍板。例：Nova 系列卖点写 PoE support，规格里 Nova X8 的连接方式却是 Ethernet。
- 入口融入产品：详情页默认限定当前产品，可切到全站；列表页是全站问答。
- 反方：向量检索对同义表达召回更好；把全部知识塞进提示词交给 LLM 也能答。但前者要嵌入模型或外部服务，评审跑不起来的风险上升；后者没有检索依据，引用无从标起。
- 何时换：知识条目上千、问法发散时上混合检索（关键词 + 向量），并用 LLM 生成、逐句标来源。

**⑦ 场景是实体，未匹配的 Best For 保留为标签**
- `best_for` 有 15 种取值，场景表只有 8 个。名称完全相同的才链接到场景实体（有自己的页面和 JSON-LD），其余原样保留。
- 反方：把 Small Retail 合并进 Retail、Multi-site Deployment 合并进 Multi-site，场景页会更饱满。但这改变了原始含义，数据说明不允许。
- 何时换：内容团队确认了场景分类后，在后台维护「标签 → 场景」映射表，由人来决定合并，而不是代码替数据决定。
- 同一原则用在 P1 → P2 的桥上：Topic 和场景名字从不完全相同（Warehouse Security / Warehouse），所以用一张人工映射表（[topic-scenario.ts](backend/src/dashboard/topic-scenario.ts)），6 个 Topic 有对应场景，Low-light Imaging（能力）和 Product Comparison（购买阶段）明确为无。看板上「最弱 Topic」和问题详情因此能直接指到该改的场景页，单测保证映射里的场景都真实存在。
- 没有任何产品的场景页（Multi-site：数据里写的是 Multi-site Deployment）仍可访问，但 `noindex`、不进 sitemap 和 llms.txt、不输出 JSON-LD：空页对 SEO 和 GEO 都是薄内容。

**⑧ 覆盖矩阵：五态编码，未监测 ≠ 从未被提及**
- 32 个问题 × 5 平台一张图：recommended / partly（部分提及+推荐）/ mentioned-only / not-mentioned（从未被提及）/ not-tracked（未监测）。indigo 同色相按明度递减，越深 = AI 越在场；「越深 = 问题越大」的编码会误导——该改的是白洞，不是深色格。
- 平台筛选时矩阵折叠（跨平台对比无意义），显示提示 + 展开按钮。
- 反方：红绿黄信号色更「直观」，但会把「未监测」和「表现差」混为一谈，且红绿对色觉障碍用户不友好。
- 何时换：问题数过百时默认只显示 Top-12（现默认 12 行 + Show all）。

**⑨ 趋势去噪：日值只有 0/25/50/75/100，所以主线用 7 日滚动**
- 一天一个平台一问，单日 Visibility 只能是 0/25/50/75/100，毛刺全是假信号；主线改用 7 日滚动窗口（第 1–6 天无完整窗口，留空），日值只作淡色散点参考。
- 反方：直接画日值折线信息更全。但 0↔100 的抖动会误导「今天暴跌」的判断。
- 何时换：单平台日问数上百（数据够密）时，日值本身有统计意义，可回到日线。

---

## 5. AI 工具使用说明

主要工具：Claude Code。

| 环节 | 怎么用 | 人的判断在哪 |
|---|---|---|
| 读题与数据摸底 | 让 AI 用脚本由明细重算全部汇总、检查 P2 关系完整性 | 定指标口径；决定 4 处数据不一致怎么处理（展示原样、Ask AI 明说冲突） |
| 方案与计划 | 先写任务拆解与实现计划（接口签名、测试真值、文件归属），再动手 | 单服务还是前后端两进程、SQLite 还是 JSON、规则还是 LLM 等取舍 |
| 实现 | 骨架自己搭；P1、P2 分给两个 AI 子代理并行实现，各自只能改自己名下的目录 | 每个模块先写失败测试，断言值是人工核过的真值（71 / 85 / 56、DeepSeek 46 等） |
| 验收 | 跑测试、类型检查、生产构建；用无头浏览器逐页点击、截图 | 不以「AI 说做完了」为准，以实测为准 |

**AI 出过的错，以及怎么发现的：**
1. **JSON-LD 漏了 Key features**：AI 写的 Product 结构化数据只放了规格。生产模式下实测「后台改一条 Feature」时发现页面变了、JSON-LD 没变。先补失败测试，再修。
2. **为绕开打包问题写了运行时 `require`**：better-sqlite3 只装在 backend 里，Next 无法把它当外部包处理，AI 的解法是在代码里手写运行时加载。合并时改成在 frontend 也声明这个依赖，让 `serverExternalPackages` 正常生效，代码回到普通 import。
3. **取整口径**：AI 起初用 `Math.round`，Claude 平台算出 63；对账测试与出题方汇总（62）不符，查出是五成双取整。

---

## 6. 不足，以及再给一周会先做什么

**当前不足**
- 行动中心的 LLM 适配层支持 Claude 与 OpenAI 兼容端点（DeepSeek 等）+ mock + 模板，但仓库不含任何真实 key，真模型演示需按 `.env.example` 自配；数字回查是「数值 + 单位」级（R11），不是结构化 fact-path 级。
- Ask AI 仍是规则版（关键词检索），没有接检索 + 生成；只支持英文提问，同义表达召回弱。
- 数据只有回答摘要（`answer_excerpt`），没有完整回答，详情页如实标为 Answer excerpt。
- 出题方数据是模板生成的：同系列 4 款产品卖点完全相同，卖点与规格有矛盾。页面原样展示，对 SEO 是近似重复内容。
- 后台没有登录，也不能编辑 FAQ；slug 改名不会生成 301 重定向。
- 端到端 16 条用例（含 375 / 1024 响应式断言），但没有视觉回归。

**再给一周的优先级**
1. **LLM 全链路实证 + 结构化回查**：配真实 key 跑一段真模型摘要并记录在案（代码已支持 Claude 与 OpenAI 兼容端点）；把 verify 升级为「数字绑定 fact path」的结构化回查（解决 R11）；Ask AI 改为检索 + 生成，回答逐句标来源，检索得分过低时拒答。
2. **内容质量**：为每个产品补独有内容，解决卖点与规格矛盾，并在后台加「卖点与规格一致性」校验。这对 SEO 去重和 GEO 实体区分都是根本问题。
3. **后台补齐**：登录、FAQ 编辑、slug 改名自动 301、编辑历史。
4. **Dashboard 交互**：平台对比切换、问题详情抽屉（拦截路由）。
5. **工程**：看板首屏改为服务端组件取数（筛选已全在 URL，迁移只是换取数位置）；补视觉回归。
