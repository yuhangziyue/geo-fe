# Craft notes — P1 Dashboard 视觉迭代

> 落码：2026-10-28 · 分支 w-signal · 依据：[dashboard-design-optimization-v1.md](dashboard-design-optimization-v1.md) §2/§3/§5（round-3 v3 定稿）
> 范围：趋势信号台 + Platform 14 日小多图 + 数据截止戳。P0（Custom 区间 / Attribution / Intent A/C 线）与 P2 均不在本次。

## 1 · 信号台材质怎么落的

- **只在 Overall 监测面生效**：`Card` 新增 `tone: 'default' | 'console'`，仅当 `by === 'overall'` 且数据已正常返回（status ok 且当日有样本）时启用 console。Attribution 分析面（归因表、View questions 链接、迁移条、Intent teal 线）保持亮卡；loading / error / empty 也保持亮卡，避免暗色上出现深色空态文本。切 Tab 即切「监测台 ↔ 分析台」，与设计稿「暗=监测台」语义一致。
- **材质零图片**：`surface-console` 复用 `ink.DEFAULT = #0F172A`（tokens.ts 里同一个 `INK` 常量，物理值只出现一次）；细网格是两条 `linear-gradient`（`line-console #1E293B` @0.85，1px / 28px），边框、表头、正文透明底，网格在整卡连续。
- **青线**：Overall 7 日滚动线 `signal-on-dark #22D3EE`、**3px，全站唯一粗线**（`CONSOLE_LINE_WIDTH`）；日值散点降为 `signal-ink #0E7490`（opacity .7 的 6px 点），永远不与主线抢视觉。
- **暗台图表体系**：chartTheme 新增 `geoConsole` 变体（轴/分割线 `#1E293B`、文字 `ink-on-console #94A3B8`、tooltip 底 `#1E293B` + 文 `ink-inverse #F1F5F9`），在 echarts.ts 注册为 `'geoConsole'`；`EChart` 新增 `theme` 与 `tone` 两个 prop，暗台的 Chart/Table 切换钮与数据表同步换暗色。
- **截止戳**：右上「● LIVE · as of Aug 30」，日期取 trend 最后一天（数据真话，不硬编码）；圆点 `signal-on-dark`，文案 `ink-on-console`；`title`/`aria-label` 明说 *static cutoff marker, not a live feed*，无任何定时器或轮询。

## 2 · 青线窗口口径（唯一合法线）

- `buildTrend(rows, days, windowDays=7, minWindowN=1)` 参数化：Overall / Intent A/C 的 7 日调用行为与旧实现**逐值不变**（默认值即旧逻辑，271 个旧测试无改动通过）。
- Platform 走 `buildPlatformTrends`：每平台一条 30 天全周期轴（筛选后仍保留全轴），**14 日窗口 + n≥8 才画线**（`PLATFORM_WINDOW_DAYS=14` / `PLATFORM_MIN_WINDOW_N=8`）；真实数据五平台全窗口 n = 8–14（末日 10–13），n≈11 与定稿一致；筛选后窗口不足 8 的平台该窗口为 null，断点不连线（`connectNulls:false`），不造线。
- 小多图 2px、`signal #0891B2`（亮底 3.68:1，图形超 3:1 非文本线），**不是第二根 3px**；单测锁定 option 层 `lineStyle.width`，像素抽检确认五张小图均无 3px 描边。
- tooltip 口径：`14-day: 11 rows · 9/11 mentioned (82%)`，不足窗口为 `14-day: —`；每格 n 徽标用**最后一个有效窗口的实际 n**（`latestWindowN`，窗口 n，绝不用全量 24）。
- 小多图在 Attribution → Platform 面板内，三列（375 单列 / sm 两列 / lg 三列——趋势卡本身只占半行宽）；canvas 对读屏不透明，另附一张 sr-only 的五平台×30 天数据表（外包 `div.sr-only`：table 直接挂 sr-only 会按内容宽度排版，在 375 顶出 20px 横向滚动）。

## 3 · Plan B 触发条件（保留不删）

- 预案常量 `PLAN_B_SIGNAL = #818CF8`（round-3-qianqian §2 的 `brand-on-console`，暗台 5.98:1、与 teal 色相差 61°）保留在 `trendCharts.ts`，单测锁定，**当前未接线**。
- **触发只由人眼走查决定，不由代码自动切换**：终审样片（`docs/screenshots/trend-signal-console.png`）里若青信号与意图 teal 在任一视图观感糊掉（注意：二者已被 Overall / Attribution 视图分离，本不该同坐标轴出现），把 console 滚动线的 `SIGNAL_ON_DARK` 换成 `PLAN_B_SIGNAL` 即可；切换后语义说法随之改为「状态靛的暗底变体」，时间语义让位给 3px 线宽 + 图例。

## 4 · 语义纪律与对比度自检

- 靛=状态/推荐：零改动；青=时间信号：仅 Overall 3px 主线（暗台 #22D3EE）与平台 14 日线（亮台 #0891B2）；青与 teal 不同轴（e2e 断言：Intent 面板不存在 console 图、minis 在 Intent 面板计数 0）。
- 矩阵五态编码未触碰。
- 关键对比度（定稿实算值）：#22D3EE on #0F172A = 9.88:1；#94A3B8 on #0F172A ≈ 6.6:1；#F1F5F9 on #1E293B 远高于旧亮卡文字对比度；#0891B2 on white = 3.68:1（图形）。无低于现值处。

## 5 · 测试设施

- backend vitest：+7（窗口参数化、n≥8 闸门、buildPlatformTrends、DTO 契约类型）。
- frontend 新增 vitest（此前前端无单测）：纯函数模块 `trendCharts.ts` 11 条（3px 唯一 / 色值 / tooltip 文案 / 窗口 n 徽标 / Plan B 常量）；root `pnpm test` 现串跑 backend + frontend。
- Playwright：新增 1 条信号台 e2e（暗台底色、戳、视图分离、5 张小图、n 徽标、tooltip）；旧归因用例因 sr-only 表成为 panel 内第一张表而做了 DOM 顺序避让（可视表仍在前）。
