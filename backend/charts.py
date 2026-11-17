"""
charts.py — LabVault 图表生成模块
使用 Plotly 生成可供前端直接渲染的 JSON 数据
支持：折线图、柱状图、散点图、箱线图、小提琴图、热力图、
      生存曲线、ROC 曲线、IC50 曲线、误差棒图、直方图、饼图等
"""

from __future__ import annotations
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import json
from typing import Any

# 默认配色方案（科研风格）
PALETTE = px.colors.qualitative.Set1
LAYOUT_DEFAULTS = dict(
    font=dict(family="Arial, sans-serif", size=14),
    plot_bgcolor="white",
    paper_bgcolor="white",
    xaxis=dict(showline=True, linecolor="black", mirror=True, ticks="outside"),
    yaxis=dict(showline=True, linecolor="black", mirror=True, ticks="outside"),
    legend=dict(bordercolor="black", borderwidth=1),
)


def _fig_to_json(fig: go.Figure) -> dict:
    """将 Plotly Figure 序列化为前端可用的字典"""
    return json.loads(fig.to_json())


# ─── 折线图 ──────────────────────────────────────────────────────────────────

def line_chart(params: dict) -> dict:
    """
    折线图
    params:
      - series: [{name, x, y, error_y(可选)}]
      - x_label, y_label, title
    """
    fig = go.Figure()
    for i, s in enumerate(params.get('series', [])):
        kw = dict(
            x=s.get('x', []),
            y=s.get('y', []),
            name=s.get('name', f'系列{i+1}'),
            mode='lines+markers',
            line=dict(color=PALETTE[i % len(PALETTE)], width=2),
            marker=dict(size=8),
        )
        if 'error_y' in s:
            kw['error_y'] = dict(type='data', array=s['error_y'], visible=True)
        fig.add_trace(go.Scatter(**kw))

    fig.update_layout(
        title=params.get('title', '折线图'),
        xaxis_title=params.get('x_label', 'X'),
        yaxis_title=params.get('y_label', 'Y'),
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 柱状图（误差棒）────────────────────────────────────────────────────────

def bar_chart(params: dict) -> dict:
    """
    柱状图（支持误差棒、分组、堆叠）
    params:
      - series: [{name, x, y, error_y(可选)}]
      - mode: 'group'（默认）/ 'stack'
      - x_label, y_label, title
    """
    fig = go.Figure()
    barmode = 'stack' if params.get('mode') == 'stack' else 'group'
    for i, s in enumerate(params.get('series', [])):
        kw = dict(
            x=s.get('x', []),
            y=s.get('y', []),
            name=s.get('name', f'系列{i+1}'),
            marker_color=PALETTE[i % len(PALETTE)],
        )
        if 'error_y' in s:
            kw['error_y'] = dict(type='data', array=s['error_y'], visible=True,
                                 color='black', thickness=1.5, width=4)
        fig.add_trace(go.Bar(**kw))

    fig.update_layout(
        barmode=barmode,
        title=params.get('title', '柱状图'),
        xaxis_title=params.get('x_label', '组别'),
        yaxis_title=params.get('y_label', '均值'),
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 散点图 ──────────────────────────────────────────────────────────────────

def scatter_chart(params: dict) -> dict:
    """
    散点图（可叠加回归线）
    params:
      - series: [{name, x, y}]
      - show_regression: bool
      - x_label, y_label, title
    """
    fig = go.Figure()
    for i, s in enumerate(params.get('series', [])):
        x = s.get('x', [])
        y = s.get('y', [])
        fig.add_trace(go.Scatter(
            x=x, y=y,
            name=s.get('name', f'系列{i+1}'),
            mode='markers',
            marker=dict(color=PALETTE[i % len(PALETTE)], size=10, opacity=0.8),
        ))
        if params.get('show_regression', False) and len(x) >= 2:
            xn = np.array(x, dtype=float)
            yn = np.array(y, dtype=float)
            mask = ~(np.isnan(xn) | np.isnan(yn))
            xn, yn = xn[mask], yn[mask]
            if len(xn) >= 2:
                m, b = np.polyfit(xn, yn, 1)
                xfit = np.linspace(xn.min(), xn.max(), 200)
                yfit = m * xfit + b
                fig.add_trace(go.Scatter(
                    x=xfit.tolist(), y=yfit.tolist(),
                    name=f'{s.get("name", "")} 回归线',
                    mode='lines',
                    line=dict(color=PALETTE[i % len(PALETTE)], dash='dash'),
                ))

    fig.update_layout(
        title=params.get('title', '散点图'),
        xaxis_title=params.get('x_label', 'X'),
        yaxis_title=params.get('y_label', 'Y'),
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 箱线图 ──────────────────────────────────────────────────────────────────

def box_chart(params: dict) -> dict:
    """
    箱线图
    params:
      - series: [{name, data}]  或  - data: {列名: [值...]}
      - show_points: bool（是否显示原始数据点）
      - x_label, y_label, title
    """
    fig = go.Figure()
    series = params.get('series', [])
    if not series and 'data' in params:
        # 兼容 {列名: 数据} 格式
        for name, vals in params['data'].items():
            series.append({'name': name, 'data': vals})

    for i, s in enumerate(series):
        points = 'all' if params.get('show_points', False) else 'outliers'
        fig.add_trace(go.Box(
            y=s.get('data', []),
            name=s.get('name', f'组{i+1}'),
            boxpoints=points,
            jitter=0.3,
            marker_color=PALETTE[i % len(PALETTE)],
            line_color='black',
            fillcolor=PALETTE[i % len(PALETTE)],
        ))

    fig.update_layout(
        title=params.get('title', '箱线图'),
        xaxis_title=params.get('x_label', '组别'),
        yaxis_title=params.get('y_label', '值'),
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 小提琴图 ────────────────────────────────────────────────────────────────

def violin_chart(params: dict) -> dict:
    """
    小提琴图
    params:
      - series: [{name, data}]
      - show_box: bool  是否内嵌箱线
      - x_label, y_label, title
    """
    fig = go.Figure()
    series = params.get('series', [])
    show_box = params.get('show_box', True)

    for i, s in enumerate(series):
        fig.add_trace(go.Violin(
            y=s.get('data', []),
            name=s.get('name', f'组{i+1}'),
            box_visible=show_box,
            meanline_visible=True,
            fillcolor=PALETTE[i % len(PALETTE)],
            line_color='black',
            opacity=0.7,
        ))

    fig.update_layout(
        title=params.get('title', '小提琴图'),
        xaxis_title=params.get('x_label', '组别'),
        yaxis_title=params.get('y_label', '值'),
        violinmode='group',
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 热力图 ──────────────────────────────────────────────────────────────────

def heatmap_chart(params: dict) -> dict:
    """
    热力图（相关矩阵、基因表达等）
    params:
      - z: 二维数值矩阵
      - x_labels, y_labels
      - colorscale: 'RdBu_r'（默认）/ 'Viridis' / 'Blues' 等
      - title
    """
    fig = go.Figure(data=go.Heatmap(
        z=params.get('z', []),
        x=params.get('x_labels', []),
        y=params.get('y_labels', []),
        colorscale=params.get('colorscale', 'RdBu_r'),
        zmid=0,
        text=params.get('z', []),
        texttemplate='%{text:.2f}' if params.get('show_values', False) else '',
        hoverongaps=False,
    ))
    fig.update_layout(
        title=params.get('title', '热力图'),
        **{k: v for k, v in LAYOUT_DEFAULTS.items() if k not in ('xaxis', 'yaxis')},
    )
    return _fig_to_json(fig)


# ─── 直方图 ──────────────────────────────────────────────────────────────────

def histogram_chart(params: dict) -> dict:
    """
    直方图（可叠加正态分布曲线）
    params:
      - data: 数值列表
      - bins: 组数（可选）
      - show_normal: 是否叠加正态曲线
      - x_label, y_label, title
    """
    data = np.array(params.get('data', []), dtype=float)
    data = data[~np.isnan(data)]

    fig = go.Figure()
    nbins = params.get('bins', 'auto')
    fig.add_trace(go.Histogram(
        x=data.tolist(),
        nbinsx=nbins if isinstance(nbins, int) else None,
        name='频次',
        marker_color=PALETTE[0],
        opacity=0.75,
    ))

    if params.get('show_normal', True) and len(data) > 1:
        mu, sigma = np.mean(data), np.std(data)
        x_range = np.linspace(mu - 4*sigma, mu + 4*sigma, 300)
        from scipy.stats import norm
        # 缩放到直方图高度
        bin_width = (data.max() - data.min()) / (nbins if isinstance(nbins, int) else 20)
        y_norm = norm.pdf(x_range, mu, sigma) * len(data) * bin_width
        fig.add_trace(go.Scatter(
            x=x_range.tolist(), y=y_norm.tolist(),
            name='正态分布',
            mode='lines',
            line=dict(color='red', width=2),
        ))

    fig.update_layout(
        title=params.get('title', '直方图'),
        xaxis_title=params.get('x_label', '值'),
        yaxis_title=params.get('y_label', '频次'),
        barmode='overlay',
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 生存曲线 ────────────────────────────────────────────────────────────────

def survival_chart(params: dict) -> dict:
    """
    Kaplan-Meier 生存曲线
    params 直接来自 stats.survival_analysis() 的结果
    """
    fig = go.Figure()
    result = params.get('survival_result', params)

    if 'groups' in result:
        for i, (grp_name, grp_data) in enumerate(result['groups'].items()):
            fig.add_trace(go.Scatter(
                x=grp_data['timeline'],
                y=grp_data['survival_function'],
                name=f'{grp_name}（中位={grp_data["median_survival"]:.1f}）',
                mode='lines',
                line=dict(color=PALETTE[i % len(PALETTE)], width=2, shape='hv'),
            ))
        # 添加 p 值注释
        if 'logrank_p' in result:
            fig.add_annotation(
                xref='paper', yref='paper', x=0.95, y=0.95,
                text=f'Log-rank p={result["logrank_p_fmt"]}',
                showarrow=False, bgcolor='rgba(255,255,255,0.8)',
                bordercolor='black', borderwidth=1,
            )
    else:
        fig.add_trace(go.Scatter(
            x=result.get('timeline', []),
            y=result.get('survival_function', []),
            name='整体',
            mode='lines',
            line=dict(color=PALETTE[0], width=2, shape='hv'),
            fill='tonexty' if 'ci_lower' in result else None,
        ))
        if 'ci_lower' in result:
            fig.add_trace(go.Scatter(
                x=result['timeline'] + result['timeline'][::-1],
                y=result['ci_upper'] + result['ci_lower'][::-1],
                fill='toself', fillcolor='rgba(31,119,180,0.1)',
                line=dict(color='rgba(255,255,255,0)'),
                name='95% CI',
            ))

    fig.update_layout(
        title=params.get('title', 'Kaplan-Meier 生存曲线'),
        xaxis_title='时间',
        yaxis_title='生存概率',
        yaxis=dict(range=[0, 1.05], showline=True, linecolor='black', mirror=True, ticks='outside'),
        xaxis=dict(showline=True, linecolor='black', mirror=True, ticks='outside'),
        **{k: v for k, v in LAYOUT_DEFAULTS.items() if k not in ('xaxis', 'yaxis')},
    )
    return _fig_to_json(fig)


# ─── ROC 曲线 ────────────────────────────────────────────────────────────────

def roc_chart(params: dict) -> dict:
    """
    ROC 曲线，params 直接来自 stats.roc_analysis() 的结果
    """
    result = params.get('roc_result', params)
    roc = result.get('roc_curve', {})
    auc_val = result.get('auc', 0)
    ci_lower = result.get('auc_ci_lower', '')
    ci_upper = result.get('auc_ci_upper', '')

    fig = go.Figure()
    # 对角参考线
    fig.add_trace(go.Scatter(
        x=[0, 1], y=[0, 1],
        mode='lines', name='随机分类器',
        line=dict(color='gray', width=1, dash='dash'),
    ))
    fig.add_trace(go.Scatter(
        x=roc.get('fpr', []),
        y=roc.get('tpr', []),
        mode='lines',
        name=f'ROC (AUC={auc_val:.3f}, 95%CI: {ci_lower:.3f}–{ci_upper:.3f})',
        line=dict(color=PALETTE[0], width=2),
        fill='tonexty',
        fillcolor='rgba(31,119,180,0.1)',
    ))
    # 最优阈值点
    best_thr = result.get('best_threshold')
    sens = result.get('sensitivity')
    spec = result.get('specificity')
    if sens is not None and spec is not None:
        fig.add_trace(go.Scatter(
            x=[1 - spec], y=[sens],
            mode='markers+text',
            name=f'最优阈值={best_thr:.3f}',
            marker=dict(color='red', size=10, symbol='star'),
            text=[f'  ({1-spec:.2f}, {sens:.2f})'],
            textposition='top right',
        ))

    fig.update_layout(
        title=params.get('title', 'ROC 曲线'),
        xaxis_title='假阳性率（1-特异性）',
        yaxis_title='真阳性率（灵敏度）',
        xaxis=dict(range=[0, 1], showline=True, linecolor='black', mirror=True, ticks='outside'),
        yaxis=dict(range=[0, 1.05], showline=True, linecolor='black', mirror=True, ticks='outside'),
        **{k: v for k, v in LAYOUT_DEFAULTS.items() if k not in ('xaxis', 'yaxis')},
    )
    return _fig_to_json(fig)


# ─── IC50/EC50 曲线 ───────────────────────────────────────────────────────────

def ic50_chart(params: dict) -> dict:
    """
    IC50/EC50 剂量-效应曲线
    params 直接来自 stats.ic50_fit() 的结果
    """
    result = params.get('ic50_result', params)
    fit_curve = result.get('fit_curve', {})
    data_points = result.get('data_points', {})

    fig = go.Figure()
    # 原始数据点
    if data_points:
        fig.add_trace(go.Scatter(
            x=data_points.get('x', []),
            y=data_points.get('y', []),
            mode='markers',
            name='实测数据',
            marker=dict(color='black', size=10, symbol='circle'),
        ))
    # 拟合曲线
    if fit_curve:
        fig.add_trace(go.Scatter(
            x=fit_curve.get('x', []),
            y=fit_curve.get('y', []),
            mode='lines',
            name=f'拟合曲线（IC50={result.get("ic50", 0):.4g}）',
            line=dict(color=PALETTE[0], width=2),
        ))
    # IC50 参考线
    ic50 = result.get('ic50')
    if ic50:
        y_mid = (result.get('top', 100) + result.get('bottom', 0)) / 2
        fig.add_hline(y=y_mid, line=dict(color='gray', dash='dot', width=1))
        fig.add_vline(x=ic50, line=dict(color='red', dash='dash', width=1),
                      annotation_text=f'IC50={ic50:.4g}',
                      annotation_position='top right')

    fig.update_layout(
        title=params.get('title', 'IC50/EC50 剂量-效应曲线'),
        xaxis_title=params.get('x_label', '浓度'),
        yaxis_title=params.get('y_label', '抑制率 (%)'),
        xaxis_type=params.get('x_axis_type', 'log'),
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 饼图/环形图 ─────────────────────────────────────────────────────────────

def pie_chart(params: dict) -> dict:
    """
    饼图或环形图
    params:
      - labels: 标签列表
      - values: 数值列表
      - hole: 0（饼图）到 0.6（环形图）
      - title
    """
    hole = params.get('hole', 0)
    fig = go.Figure(data=go.Pie(
        labels=params.get('labels', []),
        values=params.get('values', []),
        hole=hole,
        marker=dict(colors=PALETTE),
        textinfo='label+percent',
    ))
    fig.update_layout(
        title=params.get('title', '饼图'),
        **{k: v for k, v in LAYOUT_DEFAULTS.items() if k not in ('xaxis', 'yaxis')},
    )
    return _fig_to_json(fig)


# ─── 误差棒图（均值 ± SEM/SD）────────────────────────────────────────────────

def error_bar_chart(params: dict) -> dict:
    """
    均值 ± 误差棒图
    params:
      - series: [{name, mean, error, n(可选)}]
      - error_type: 'sem' / 'sd' / 'ci95'（仅标注用）
      - x_label, y_label, title
    """
    series = params.get('series', [])
    error_type = params.get('error_type', 'sem')
    fig = go.Figure()

    names = [s.get('name', f'组{i+1}') for i, s in enumerate(series)]
    means = [s.get('mean', 0) for s in series]
    errors = [s.get('error', 0) for s in series]

    fig.add_trace(go.Bar(
        x=names, y=means,
        error_y=dict(type='data', array=errors, visible=True,
                     color='black', thickness=1.5, width=4),
        marker_color=[PALETTE[i % len(PALETTE)] for i in range(len(series))],
        name=f'均值 ± {error_type.upper()}',
    ))
    fig.update_layout(
        title=params.get('title', f'均值 ± {error_type.upper()} 图'),
        xaxis_title=params.get('x_label', '组别'),
        yaxis_title=params.get('y_label', '均值'),
        **LAYOUT_DEFAULTS,
    )
    return _fig_to_json(fig)


# ─── 相关矩阵热力图 ───────────────────────────────────────────────────────────

def correlation_heatmap(params: dict) -> dict:
    """
    相关矩阵热力图
    params:
      - data: {列名: 数值列表} 字典
      - method: 'pearson'（默认）/ 'spearman'
    """
    import pandas as pd
    df = pd.DataFrame(params.get('data', {}))
    method = params.get('method', 'pearson')
    corr = df.corr(method=method)

    return heatmap_chart({
        'z': corr.values.tolist(),
        'x_labels': corr.columns.tolist(),
        'y_labels': corr.index.tolist(),
        'colorscale': 'RdBu_r',
        'show_values': True,
        'title': params.get('title', f'{method.capitalize()} 相关矩阵'),
    })


# ─── 主入口：路由分发 ─────────────────────────────────────────────────────────

CHART_HANDLERS = {
    'line':           line_chart,
    'bar':            bar_chart,
    'scatter':        scatter_chart,
    'box':            box_chart,
    'violin':         violin_chart,
    'heatmap':        heatmap_chart,
    'histogram':      histogram_chart,
    'survival':       survival_chart,
    'roc':            roc_chart,
    'ic50':           ic50_chart,
    'pie':            pie_chart,
    'error_bar':      error_bar_chart,
    'corr_heatmap':   correlation_heatmap,
}


def generate_chart(params: dict) -> dict:
    """
    统一图表生成入口
    params 必须包含 'chart_type' 字段
    """
    chart_type = params.get('chart_type', '')
    handler = CHART_HANDLERS.get(chart_type)
    if not handler:
        return {
            "error": f"不支持的图表类型: {chart_type}",
            "supported": list(CHART_HANDLERS.keys()),
        }
    try:
        return {"success": True, "plotly_json": handler(params)}
    except Exception as e:
        return {"error": f"图表生成失败: {str(e)}"}
