# LabVault 科研数据管理系统

> 面向科研人员的桌面端数据管理与统计分析工具，对标 GraphPad Prism，提供完整的数据录入、统计分析、图表生成和报告导出能力。

---

## ✨ 功能特性

| 模块 | 功能 |
|------|------|
| 📊 数据管理 | 表格录入、CSV/Excel 导入、拖放上传 |
| 📈 统计分析 | t 检验、ANOVA、非参数检验、回归、生存分析、ROC、IC50/EC50 |
| 🎨 图表构建 | 柱状图、折线图、散点图、箱线图、热图、生存曲线（Plotly 渲染） |
| 📄 报告导出 | PDF 报告、SVG/PNG 图表、Excel 数据表 |
| 🗂️ 项目管理 | 多项目管理，SQLite 本地存储 |

---

## 🛠️ 技术栈

```
前端：React 18 + Material UI v5 + Plotly.js + React Router v6
后端：Python 3.9 + Flask + pandas + scipy + statsmodels + lifelines
桌面：Electron 28
数据库：SQLite（本地，无需服务器）
```

---

## 🚀 快速开始

### 前置要求

- **Node.js** ≥ 18.0（推荐 20 LTS）
- **Python** ≥ 3.9
- **npm** ≥ 9.0（或 yarn ≥ 1.22）

### 1. 克隆项目

```bash
git clone https://github.com/labvault/labvault.git
cd labvault
```

### 2. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖
pip3 install -r backend/requirements.txt
```

### 3. 开发模式启动

```bash
npm run dev
# 此命令会同时启动：
#   - Python Flask 后端（http://localhost:5050）
#   - React 开发服务器（http://localhost:3000）
#   - Electron 主进程（加载 http://localhost:3000）
```

> **提示**：首次启动需等待约 5 秒让 React 编译完成，Electron 窗口将自动弹出。

### 4. 单独启动各服务（调试用）

```bash
# 仅启动 Python 后端
npm run backend

# 仅启动 React 前端
npm start

# 仅启动 Electron（需先启动前端）
npm run electron
```

---

## 📦 构建发布版

```bash
# 构建 React 前端
npm run build

# 打包 Electron 应用
npm run package

# 产物输出至 release/ 目录
```

---

## 📁 项目结构

```
labvault/
├── electron/               # Electron 主进程
│   ├── main.js             # 主进程入口（窗口管理、IPC、子进程）
│   ├── preload.js          # 预加载脚本（安全暴露 API）
│   └── menu.js             # 应用菜单
├── src/                    # React 前端源码
│   ├── App.js              # 路由和主布局
│   ├── theme.js            # MUI 主题配置
│   ├── pages/              # 页面组件
│   │   ├── Dashboard.js    # 仪表盘
│   │   ├── Projects.js     # 项目管理
│   │   ├── DataTable.js    # 数据表格
│   │   ├── ChartBuilder.js # 图表构建器
│   │   ├── Statistics.js   # 统计分析
│   │   └── Export.js       # 导出
│   ├── components/         # 通用组件
│   │   ├── Sidebar.js      # 导航侧边栏
│   │   ├── ChartViewer.js  # Plotly 图表
│   │   ├── DataImport.js   # 数据导入
│   │   └── StatResults.js  # 统计结果展示
│   └── utils/
│       └── api.js          # Axios API 封装
├── backend/                # Python Flask 后端
│   ├── server.py           # Flask 主服务（端口 5050）
│   ├── db.py               # SQLite 数据库层
│   ├── stats.py            # 统计分析模块
│   ├── charts.py           # 图表生成模块
│   ├── import_data.py      # 数据导入模块
│   ├── export.py           # 导出模块
│   └── requirements.txt    # Python 依赖
├── public/
│   └── index.html          # HTML 入口
├── .env                    # 开发环境变量
├── .gitignore              # Git 忽略规则
└── package.json            # npm 配置和脚本
```

---

## 🔧 配置说明

### 环境变量（`.env`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BROWSER` | `none` | 禁止 React 自动打开浏览器 |
| `PORT` | `3000` | React 开发服务器端口 |
| `REACT_APP_API_BASE` | `http://localhost:5050` | Python 后端 API 地址 |

### 修改后端端口

如需修改 Flask 端口，同时修改：
1. `backend/server.py` 中的 `port` 参数
2. `.env` 中的 `REACT_APP_API_BASE`
3. `src/utils/api.js` 中的 baseURL

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + N` | 新建项目 |
| `Cmd/Ctrl + O` | 打开项目 |
| `Cmd/Ctrl + S` | 保存 |
| `Cmd/Ctrl + I` | 导入数据 |
| `Cmd/Ctrl + E` | 导出报告 |
| `Cmd/Ctrl + 1~5` | 切换页面 |
| `Cmd/Ctrl + R` | 重新加载 |

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交变更：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

---

## 📄 许可证

MIT License © 2024 LabVault Team
