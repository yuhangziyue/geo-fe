# AI 全栈工程师（偏前端）笔试测试数据｜扩充版

本数据为虚构品牌 AsterVision 的测试数据，仅用于笔试。

## Project 1：AI Visibility Dashboard
- `dashboard_summary.json`：品牌总览、5 个 AI 平台、30 天趋势、8 个 Topic 聚合指标。
- `questions.json`：120 条 AI 问题明细，字段包括日期、平台、Topic、S/A/B/C 意图类型、Mention、Recommendation、产品提及、回答摘要、Citation 等。

建议候选人至少实现：总览指标、趋势图、平台对比、Topic 分析、问题列表筛选、问题详情。

## Project 2：Brand Knowledge Center
- `brand.json`：品牌基础信息。
- `product_series.json`：5 个产品系列。
- `products.json`：20 个产品。
- `faqs.json`：40 条 FAQ。
- `scenarios.json`：8 个应用场景。

建议候选人至少实现：产品列表、Series 筛选、Product Detail、FAQ、动态路由、Metadata/JSON-LD，以及简单 Ask AI/AI Summary 交互。

## 说明
1. 候选人可以补充字段、增加 Mock 数据，但不得修改已有字段的原始含义。
2. 不要求自行爬取数据。
3. 不强制调用付费大模型 API；AI Insight / Ask AI 可以使用 Mock 结果。真实 LLM API / RAG 接入作为加分项。
4. 重点考察前端工程、数据建模、交互体验、API/数据流和 AI 产品理解，而非数据清洗。
