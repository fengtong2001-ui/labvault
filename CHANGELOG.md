# Changelog

LabVault — 科研数据管理与统计绘图系统。所有显著更新记录于此。
格式参考 Keep a Changelog;协作模式:ZCode × Antigravity swarm。

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
