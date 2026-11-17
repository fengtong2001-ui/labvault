# Changelog

LabVault — 科研数据管理与统计绘图系统。所有显著更新记录于此。
格式参考 Keep a Changelog;协作模式:ZCode × Antigravity swarm。

## [0.2.16-alpha] 2026-11-18 第 17 轮(统计↔数据表双向深链)

### 新增
- 统计页来源 Chip 可点击 → /data?dataset=&project=
- 数据表格支持 URL 深链(优先于自动选中),三页互跳全带数据集上下文

### 详见
- docs/announcements/2026-11-18-round17.md

## [0.2.15-alpha] 2026-11-18 第 16 轮(摘要 CSV + 结果 JSON)

### 新增
- 工作簿分析条目导出摘要 CSV(BOM,Excel 直开)
- 统计页「导出结果 JSON」(保存前也可导,含 method/参数/结果)

### 详见
- docs/announcements/2026-11-18-round16.md

## [0.2.14-alpha] 2026-11-18 第 15 轮(导出页数据预览 + 页码清理)

### 新增
- Export 页当前数据集预览表(名称/维度 Chip/前 6 行真实数据)

### 修复
- 移除 matplotlib PDF 路径硬编码的误导性页码

### 详见
- docs/announcements/2026-11-18-round15.md

## [0.2.13-alpha] 2026-11-18 第 14 轮(快速统计联动 + PDF 预览打磨)

### 打磨
- 快速统计联动:点分类列自动按组统计(每组 mean±SD+n);数值列保持单列统计
- PDF 数据预览独立成页,列宽自适应 + 维度标题(不再与首页统计表重叠)

### 详见
- docs/announcements/2026-11-18-round14.md

## [0.2.12-alpha] 2026-11-18 第 13 轮(组间均值明细 + 工作簿空态)

### 打磨
- 快速统计条组间均值升级为逐组 Chip(mean±SD,n=…)
- 工作簿面板空态引导文案
- 工作簿聚合 PDF 的 notes 自动含数据集维度

### 详见
- docs/announcements/2026-11-18-round13.md

## [0.2.11-alpha] 2026-11-18 第 12 轮(工作簿条目导出 JSON)

### 新增
- 工作簿分析条目 ⬇ 导出 `labvault-analysis-<id>.json`(参数+结果可复现)
- 工作簿图表条目 ⬇ 导出 `labvault-chart-<id>.json`(完整 Plotly 规格)

### 详见
- docs/announcements/2026-11-18-round12.md

## [0.2.10-alpha] 2026-11-18 第 11 轮(分析条目重命名 + 深色走查)

### 新增
- analyses 表 title 列(CREATE TABLE + 幂等 ALTER TABLE 迁移)
- PUT /api/analyses/<id> 重命名路由 + db.update_analysis
- 工作簿分析条目 ✏️ 重命名按钮,标题优先显示

### 走查
- 深色模式一致性:工作簿面板/分组均值条/工具栏渲染一致,无需修复

### 详见
- docs/announcements/2026-11-18-round11.md

## [0.2.9-alpha] 2026-11-18 第 10 轮(分组对比入口 + 图表重命名)

### 新增
- 快速统计条实时显示分组均值(分类列→数值列)+「按组对比 (t 检验)」一键入口
  (自动保存 → 统计页按组预填)
- 工作簿图表重命名:PUT /api/charts/<id>(db.update_chart)

### 详见
- docs/announcements/2026-11-18-round10.md

## [0.2.8-alpha] 2026-11-18 第 9 轮(列级快速统计 + 运行方式切换)

### 新增
- 数据表格列头快速统计:点 📊 图标即出 n/mean±SD/min/max,随网格实时重算
- scripts/serve_spa.py:零依赖 SPA 静态服务器

### 修复(工程)
- CRA5 dev server 在 Node 24 下"编译成功但服务旧内存包"——日常运行切换为
  生产构建 + serve_spa.py(详见 round9 公告)

### 详见
- docs/announcements/2026-11-18-round9.md

## [0.2.7-alpha] 2026-11-18 第 8 轮(数据集保存体验)

### 新增
- 未保存改动跟踪:名称栏提示 + 警示 Chip + 「保存表格 *」+ beforeunload 守卫
- 保存自动命名:默认名/空名时按「项目名-数据集-日期」生成并回填

### 详见
- docs/announcements/2026-11-18-round8.md

## [0.2.6-alpha] 2026-11-18 第 7 轮(工作簿条目管理)

### 新增
- 工作簿图表/分析条目删除(带确认)+ 后端 DELETE /api/analyses/<id>、
  DELETE /api/charts/<id>
- 图表条目「重新生成」:/charts?dataset=&project=&type= 直达指定图型自动生成

### 详见
- docs/announcements/2026-11-18-round7.md

## [0.2.5-alpha] 2026-11-18 第 6 轮(工作簿聚合 PDF 报告)

### 新增
- Export 页「导出工作簿报告」:聚合数据集下全部已落库分析与图表,
  charts_plotly 每张独立一页(kaleido 渲染)
- `export_pdf_report` 新增 charts_plotly 参数

### 修复
- Export 页普通 PDF 导出的假统计/假表格 → 使用当前数据集真实预览

### 详见
- docs/announcements/2026-11-18-round6.md

## [0.2.4-alpha] 2026-11-18 第 5 轮(双向关联 + 主题持久化)

### 新增
- 工作簿分析条目「从该分析出图」:历史分析一键跳转图表页并自动挂钩 analysis_id
- 主题偏好持久化(localStorage),刷新/重开不再回退浅色

### 详见
- docs/announcements/2026-11-18-round5.md

## [0.2.3-alpha] 2026-11-18 第 4 轮(工作簿回看 + 关联链)

### 新增
- 工作簿图表条目点击回看(Dialog 渲染已存 Plotly);分析条目点击展开统计摘要
- analysis_id 关联链:统计页保存后「生成关联图表」→ 图表保存自动携带 analysis_id
- 修复:数据集列表自动选中覆盖 URL ?dataset= 的问题

### 详见
- docs/announcements/2026-11-18-round4.md

## [0.2.2-alpha] 2026-11-18 第 3 轮(特殊图型两段式 + 工作簿面板)

### 新增
- IC50/KM/ROC 从数据集自动推导统计参数并两段式出图
  (统计 API → 图表 API,列名语义识别)
- 数据表格页「工作簿」面板:数据集下已保存的图表与分析结果一览

### 详见
- docs/announcements/2026-11-18-round3.md

## [0.2.1-alpha] 2026-11-18 第 2 轮(结果工作表落库)

### 新增
- `POST/GET /api/analyses`、`POST/GET /api/charts` 落库路由(复用 db 层
  save_analysis/save_chart)
- 统计页「保存到数据集」、图表页「保存图表」按钮 + 即时反馈
- `utils/api.js` 新增 `analysesApi`、`chartsApi.save/list`

### 详见
- docs/announcements/2026-11-18-round2.md

## [0.2.0-alpha] 2026-11-18 第 1 轮(用户验收修复 + GraphPad 式整合)

### 修复
- **全站布局失调**(用户报告#1):主内容区 flex column 与页面根 `mx:auto`
  互相抵消导致整页收缩(仪表盘/项目管理文字一字一行竖排)。根因修复于
  `App.js`,全站生效。
- ChartBuilder 演示数据参数与后端 schema 不匹配(bar 页面从未真正出过图)
- 后端缺失 `PUT /api/datasets/<id>`(已存数据集无法「保存表格」)
  → 新增 `db.update_dataset()` + 路由

### 新增
- **数据集上下文贯通**(用户报告#2 第一阶段):数据表格页「以此数据运行统计 /
  生成分析图表」跳转携带 `?dataset=&project=`,统计页自动识别分组并预填
  (≥3 组自动转 ANOVA 预填),图表页用真实数据构建 series(柱状图 = 均值±SD),
  两页均显示「数据来源」标签
- 新工具模块 `src/utils/datasetStats.js`:列类型识别、分组聚合、t 检验/图表
  参数推导,三个页面共享

### 详见
- docs/announcements/2026-11-18-round1.md

## [0.1.0] 2026-11-17(Antigravity swarm 初版)

- Flask 后端:projects/datasets CRUD、全套统计引擎(t/ANOVA/非参/回归/IC50/KM/ROC)、
  Plotly 图表引擎、CSV/Excel 导入、SVG/PNG/Excel/PDF 导出
- React 18 + MUI v5 前端六页;Electron 桌面壳
- 由 Antigravity swarm(coordinator + backend/frontend/electron-dev)构建
