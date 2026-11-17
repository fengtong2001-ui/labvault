"""
db.py — LabVault SQLite 数据库初始化和 ORM 层
提供数据库连接、表创建、及项目/数据集的 CRUD 操作
"""

from __future__ import annotations
import sqlite3
import json
import os
from datetime import datetime

# 数据库文件路径（相对于后端目录）
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'labvault.db')


def get_conn():
    """获取数据库连接，启用 WAL 模式提升并发性能"""
    conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row  # 使返回结果可按列名访问
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """初始化数据库：创建所有必要的表"""
    conn = get_conn()
    cur = conn.cursor()

    # 项目表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            description TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        )
    """)

    # 数据集表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS datasets (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            description TEXT,
            data_json   TEXT,          -- 存储表格数据（JSON 格式）
            columns_json TEXT,         -- 列定义（名称、类型）
            source_file TEXT,          -- 原始导入文件名
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        )
    """)

    # 分析结果表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS analyses (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id  INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
            project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            type        TEXT NOT NULL,  -- ttest, anova, regression 等
            title       TEXT DEFAULT '',-- 条目标题(工作簿重命名)—— zcode
            params_json TEXT,           -- 分析参数
            result_json TEXT,           -- 分析结果
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)

    # 轻量迁移:旧库补 analyses.title 列 —— zcode
    try:
        cur.execute("ALTER TABLE analyses ADD COLUMN title TEXT DEFAULT ''")
    except Exception:
        pass  # 列已存在

    # 图表表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS charts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id   INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
            project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            analysis_id  INTEGER REFERENCES analyses(id) ON DELETE SET NULL,
            title        TEXT,
            chart_type   TEXT NOT NULL,  -- bar, line, scatter, box 等
            plotly_json  TEXT,           -- Plotly 图表 JSON
            created_at   TEXT DEFAULT (datetime('now'))
        )
    """)

    conn.commit()
    conn.close()


# ─── 项目 CRUD ───────────────────────────────────────────────────────────────

def create_project(name: str, description: str = '') -> dict:
    """创建新项目，返回项目字典"""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO projects (name, description) VALUES (?, ?)",
        (name, description)
    )
    conn.commit()
    project_id = cur.lastrowid
    conn.close()
    return get_project(project_id)


def get_project(project_id: int) -> dict | None:
    """根据 ID 获取项目"""
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def list_projects() -> list[dict]:
    """列出所有项目（按更新时间降序）"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM projects ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_project(project_id: int, name: str = None, description: str = None) -> dict | None:
    """更新项目信息"""
    conn = get_conn()
    fields, values = [], []
    if name is not None:
        fields.append("name = ?"); values.append(name)
    if description is not None:
        fields.append("description = ?"); values.append(description)
    if not fields:
        conn.close()
        return get_project(project_id)
    fields.append("updated_at = datetime('now')")
    values.append(project_id)
    conn.execute(f"UPDATE projects SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return get_project(project_id)


def delete_project(project_id: int) -> bool:
    """删除项目（级联删除数据集、分析结果、图表）"""
    conn = get_conn()
    cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected > 0


# ─── 数据集 CRUD ─────────────────────────────────────────────────────────────

def create_dataset(project_id: int, name: str, data: list[dict],
                   columns: list[dict] = None, description: str = '',
                   source_file: str = '') -> dict:
    """
    创建数据集
    :param data: 行数据列表，每行为 {列名: 值} 字典
    :param columns: 列定义列表，如 [{'name': 'x', 'type': 'numeric'}]
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO datasets (project_id, name, description, data_json, columns_json, source_file)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (project_id, name, description,
         json.dumps(data, ensure_ascii=False),
         json.dumps(columns or [], ensure_ascii=False),
         source_file)
    )
    conn.commit()
    dataset_id = cur.lastrowid
    # 更新项目的 updated_at
    conn.execute("UPDATE projects SET updated_at = datetime('now') WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return get_dataset(dataset_id)


def get_dataset(dataset_id: int) -> dict | None:
    """根据 ID 获取数据集（含解析后的 data 和 columns）"""
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM datasets WHERE id = ?", (dataset_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d['data'] = json.loads(d.pop('data_json') or '[]')
    d['columns'] = json.loads(d.pop('columns_json') or '[]')
    return d


def list_datasets(project_id: int) -> list[dict]:
    """列出项目下所有数据集"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM datasets WHERE project_id = ? ORDER BY created_at DESC",
        (project_id,)
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d['data'] = json.loads(d.pop('data_json') or '[]')
        d['columns'] = json.loads(d.pop('columns_json') or '[]')
        result.append(d)
    return result


def delete_dataset(dataset_id: int) -> bool:
    """删除数据集"""
    conn = get_conn()
    cur = conn.execute("DELETE FROM datasets WHERE id = ?", (dataset_id,))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected > 0


def update_dataset(dataset_id: int, name: str = None, data: list = None,
                   columns: list = None, description: str = None) -> dict | None:
    """更新数据集(由 ZCode 添加:前端保存表格需要 PUT 路由)"""
    ds = get_dataset(dataset_id)
    if not ds:
        return None
    new_name = name if name is not None else ds['name']
    new_desc = description if description is not None else ds.get('description')
    new_data = data if data is not None else (
        json.loads(ds['data_json']) if isinstance(ds.get('data_json'), str)
        else json.loads(json.dumps(ds.get('data') or [])))
    new_cols = columns if columns is not None else (
        json.loads(ds['columns_json']) if isinstance(ds.get('columns_json'), str)
        else json.loads(json.dumps(ds.get('columns') or [])))
    conn = get_conn()
    conn.execute(
        """UPDATE datasets SET name = ?, description = ?, data_json = ?, columns_json = ?,
           updated_at = datetime('now') WHERE id = ?""",
        (new_name, new_desc,
         json.dumps(new_data, ensure_ascii=False),
         json.dumps(new_cols, ensure_ascii=False),
         dataset_id)
    )
    conn.commit()
    conn.close()
    return get_dataset(dataset_id)


# ─── 分析结果 CRUD ───────────────────────────────────────────────────────────

def delete_analysis(analysis_id: int) -> bool:
    """删除分析结果(由 ZCode 添加:工作簿条目管理)"""
    conn = get_conn()
    cur = conn.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected > 0


def delete_chart(chart_id: int) -> bool:
    """删除图表(由 ZCode 添加:工作簿条目管理)"""
    conn = get_conn()
    cur = conn.execute("DELETE FROM charts WHERE id = ?", (chart_id,))
    conn.commit()
    affected = cur.rowcount
    conn.close()
    return affected > 0


def update_chart(chart_id: int, title: str = None, plotly_json: dict = None) -> dict | None:
    """更新图表标题/数据(由 ZCode 添加:工作簿重命名)"""
    conn = get_conn()
    row = conn.execute("SELECT * FROM charts WHERE id = ?", (chart_id,)).fetchone()
    if not row:
        conn.close()
        return None
    d = dict(row)
    new_title = title if title is not None else d.get('title')
    new_plotly = json.dumps(plotly_json, ensure_ascii=False) if plotly_json is not None else d.get('plotly_json')
    conn.execute(
        "UPDATE charts SET title = ?, plotly_json = ? WHERE id = ?",
        (new_title, new_plotly, chart_id)
    )
    conn.commit()
    out = conn.execute("SELECT * FROM charts WHERE id = ?", (chart_id,)).fetchone()
    conn.close()
    d2 = dict(out)
    d2['plotly'] = json.loads(d2.pop('plotly_json') or '{}')
    return d2

def save_analysis(analysis_type: str, params: dict, result: dict,
                  dataset_id: int = None, project_id: int = None,
                  title: str = '') -> dict:
    """保存分析结果"""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO analyses (dataset_id, project_id, type, title, params_json, result_json)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (dataset_id, project_id, analysis_type, title,
         json.dumps(params, ensure_ascii=False),
         json.dumps(result, ensure_ascii=False))
    )
    conn.commit()
    analysis_id = cur.lastrowid
    row = conn.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    conn.close()
    d = dict(row)
    d['params'] = json.loads(d.pop('params_json') or '{}')
    d['result'] = json.loads(d.pop('result_json') or '{}')
    return d


def update_analysis(analysis_id: int, title: str = None) -> dict | None:
    """更新分析结果标题(由 ZCode 添加:工作簿重命名)"""
    conn = get_conn()
    row = conn.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    if not row:
        conn.close()
        return None
    conn.execute("UPDATE analyses SET title = ? WHERE id = ?", (title, analysis_id))
    conn.commit()
    out = conn.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    conn.close()
    d = dict(out)
    d['params'] = json.loads(d.pop('params_json') or '{}')
    d['result'] = json.loads(d.pop('result_json') or '{}')
    return d


def list_analyses(project_id: int = None, dataset_id: int = None) -> list[dict]:
    """列出分析结果"""
    conn = get_conn()
    if dataset_id:
        rows = conn.execute(
            "SELECT * FROM analyses WHERE dataset_id = ? ORDER BY created_at DESC",
            (dataset_id,)
        ).fetchall()
    elif project_id:
        rows = conn.execute(
            "SELECT * FROM analyses WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,)
        ).fetchall()
    else:
        rows = []
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d['params'] = json.loads(d.pop('params_json') or '{}')
        d['result'] = json.loads(d.pop('result_json') or '{}')
        result.append(d)
    return result


# ─── 图表 CRUD ───────────────────────────────────────────────────────────────

def save_chart(chart_type: str, plotly_json: dict, title: str = '',
               dataset_id: int = None, project_id: int = None,
               analysis_id: int = None) -> dict:
    """保存图表"""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO charts (dataset_id, project_id, analysis_id, title, chart_type, plotly_json)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (dataset_id, project_id, analysis_id, title, chart_type,
         json.dumps(plotly_json, ensure_ascii=False))
    )
    conn.commit()
    chart_id = cur.lastrowid
    row = conn.execute("SELECT * FROM charts WHERE id = ?", (chart_id,)).fetchone()
    conn.close()
    d = dict(row)
    d['plotly'] = json.loads(d.pop('plotly_json') or '{}')
    return d


def list_charts(project_id: int = None, dataset_id: int = None) -> list[dict]:
    """列出图表"""
    conn = get_conn()
    if dataset_id:
        rows = conn.execute(
            "SELECT * FROM charts WHERE dataset_id = ? ORDER BY created_at DESC",
            (dataset_id,)
        ).fetchall()
    elif project_id:
        rows = conn.execute(
            "SELECT * FROM charts WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,)
        ).fetchall()
    else:
        rows = []
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d['plotly'] = json.loads(d.pop('plotly_json') or '{}')
        result.append(d)
    return result


# 应用启动时自动初始化数据库
init_db()
