"""
export.py — LabVault 导出模块
支持科研数据与分析结果的多格式导出：
  - PDF 报告（使用 ReportLab 生成排版精美的多页专业实验报告，包含统计表与图表）
  - SVG / PNG 图表导出（支持 Plotly 矢量转存或 Matplotlib 高分辨率 300/600 DPI 渲染）
  - Excel 导出（使用 pandas / openpyxl 生成多工作表、带格式的专业实验数据表）
"""

from __future__ import annotations
import io
import os
import json
import base64
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

# 导入 ReportLab 组件（若不可用则启用 Matplotlib 高保真 PDF 引擎）
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether, PageBreak
    )
    from reportlab.lib.units import inch, cm
    from reportlab.pdfgen import canvas
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


if HAS_REPORTLAB:
    class NumberedCanvas(canvas.Canvas):
        """自定义带页脚页码与页眉的 Canvas"""
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_header_footer(num_pages)
                super().showPage()
            super().save()

        def draw_header_footer(self, page_count):
            self.saveState()
            self.setFont("Helvetica", 9)
            self.setStrokeColor(colors.HexColor('#CCCCCC'))
            self.setLineWidth(0.5)

            # 页眉
            self.line(54, 11 * inch - 40, 8.5 * inch - 54, 11 * inch - 40)
            self.drawString(54, 11 * inch - 35, "LabVault Scientific Data & Analysis Report")
            self.drawRightString(8.5 * inch - 54, 11 * inch - 35, datetime.now().strftime("%Y-%m-%d %H:%M"))

            # 页脚
            self.line(54, 45, 8.5 * inch - 54, 45)
            self.drawString(54, 32, "Confidential - For Research Use Only")
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(8.5 * inch - 54, 32, page_text)
            self.restoreState()
else:
    NumberedCanvas = None


def _export_pdf_matplotlib(
    title: str,
    project_name: str,
    dataset_name: str,
    stats_results: Optional[List[Dict[str, Any]]],
    table_data: Optional[List[Dict[str, Any]]],
    chart_image_base64: Optional[str],
    charts_plotly: Optional[List[Dict[str, Any]]] = None,
    notes: str = ""
) -> io.BytesIO:
    """使用 Matplotlib 生成高质量科学 PDF 报告（ReportLab 未安装时的备选方案）"""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    from PIL import Image

    buffer = io.BytesIO()
    with PdfPages(buffer) as pdf:
        # Page 1: 标题、元信息与统计结果表格
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.axis('off')

        # 头部标题
        ax.text(0.5, 0.95, title, fontsize=18, fontweight='bold', ha='center', color='#1A365D')
        ax.text(0.5, 0.92, f"Project: {project_name}   |   Dataset: {dataset_name}", fontsize=11, ha='center', color='#4A5568')
        ax.text(0.5, 0.89, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}   |   LabVault Core", fontsize=9, ha='center', color='#718096')
        ax.plot([0.05, 0.95], [0.87, 0.87], color='#CBD5E0', lw=1, transform=ax.transAxes)

        y_pos = 0.83
        if notes:
            ax.text(0.06, y_pos, "1. 实验概述与结论 (Summary & Notes):", fontsize=11, fontweight='bold', color='#2B6CB0')
            y_pos -= 0.03
            ax.text(0.06, y_pos, notes[:300], fontsize=9, color='#2D3748', va='top')
            y_pos -= 0.08

        # 统计结果
        if stats_results:
            ax.text(0.06, y_pos, "2. 统计学检验分析结果 (Statistical Analysis):", fontsize=11, fontweight='bold', color='#2B6CB0')
            y_pos -= 0.04
            table_cells = [["Test", "Key Statistic", "P-Value", "Significance", "Conclusion"]]
            for res in stats_results[:8]:
                t_name = str(res.get('test_type', res.get('type', res.get('test', 'Test'))))[:15]
                stat_val = str(res.get('t_statistic', res.get('f_statistic', res.get('u_statistic', res.get('r_squared', '-')))))[:8]
                p_val = str(res.get('p_value_fmt', res.get('p_value', '-')))[:8]
                sig = str(res.get('significance', ''))
                concl = str(res.get('conclusion', ''))[:30]
                table_cells.append([t_name, stat_val, p_val, sig, concl])

            tbl = ax.table(cellText=table_cells, colWidths=[0.18, 0.18, 0.14, 0.14, 0.3], loc='center', bbox=[0.05, y_pos - 0.22, 0.9, 0.2])
            tbl.auto_set_font_size(False)
            tbl.set_fontsize(8)
            for (r, c), cell in tbl.get_celld().items():
                if r == 0:
                    cell.set_facecolor('#2B6CB0')
                    cell.set_text_props(color='white', fontweight='bold')
                else:
                    cell.set_facecolor('#F7FAFC' if r % 2 == 0 else 'white')
            y_pos -= 0.26

        # 数据预览移至独立页面(第 2 页),避免与统计表格挤压重叠 —— zcode

        # 页脚
        ax.plot([0.05, 0.95], [0.05, 0.05], color='#E2E8F0', lw=1, transform=ax.transAxes)
        ax.text(0.05, 0.03, "LabVault - Confidential - For Research Use Only", fontsize=8, color='#A0AEC0')

        pdf.savefig(fig, bbox_inches='tight')
        plt.close(fig)

        # Page 2: 数据预览(独立成页,列宽按内容自适应)—— zcode
        if table_data and len(table_data) > 0:
            figp, axp = plt.subplots(figsize=(8.5, 11))
            axp.axis('off')
            df_p = pd.DataFrame(table_data)
            axp.text(0.5, 0.95, "数据预览 (Data Preview)", fontsize=16, fontweight='bold',
                     ha='center', color='#1A365D')
            axp.text(0.5, 0.92, f"共 {len(table_data)} 行 × {len(df_p.columns)} 列,此处展示前 8 行",
                     fontsize=10, ha='center', color='#4A5568')
            axp.plot([0.05, 0.95], [0.90, 0.90], color='#CBD5E0', lw=1, transform=axp.transAxes)

            preview_cells = [list(df_p.columns)]
            for _, r in df_p.head(8).iterrows():
                preview_cells.append([str(r[c])[:14] for c in df_p.columns])
            n_cols = max(1, len(df_p.columns))
            col_w = min(0.9 / n_cols, 0.25)
            t_prev = axp.table(cellText=preview_cells, loc='center',
                               bbox=[0.05, 0.35, 0.9, 0.45])
            t_prev.auto_set_font_size(False)
            t_prev.set_fontsize(8)
            for (r, c), cell in t_prev.get_celld().items():
                if r == 0:
                    cell.set_facecolor('#2B6CB0')
                    cell.set_text_props(color='white', fontweight='bold')
                else:
                    cell.set_facecolor('#F7FAFC' if r % 2 == 0 else 'white')
            axp.text(0.05, 0.03, "LabVault - Confidential - For Research Use Only", fontsize=8, color='#A0AEC0')
            pdf.savefig(figp, bbox_inches='tight')
            plt.close(figp)

        # Page 3+: 图表页（若有图表图片）
        if chart_image_base64:
            fig2, ax2 = plt.subplots(figsize=(8.5, 11))
            ax2.axis('off')
            ax2.text(0.5, 0.95, "实验可视化图表 (Scientific Visualization)", fontsize=16, fontweight='bold', ha='center', color='#1A365D')
            ax2.plot([0.05, 0.95], [0.93, 0.93], color='#CBD5E0', lw=1, transform=ax2.transAxes)

            try:
                b64_clean = chart_image_base64.split(',', 1)[1] if ',' in chart_image_base64 else chart_image_base64
                img_data = base64.b64decode(b64_clean)
                img = Image.open(io.BytesIO(img_data))
                # 绘制图像到中心
                ax_img = fig2.add_axes([0.1, 0.25, 0.8, 0.6])
                ax_img.imshow(img)
                ax_img.axis('off')
            except Exception as e:
                ax2.text(0.5, 0.5, f"[图表渲染错误: {e}]", ha='center', color='red')

            ax2.plot([0.05, 0.95], [0.05, 0.05], color='#E2E8F0', lw=1, transform=ax2.transAxes)
            ax2.text(0.05, 0.03, "LabVault - Confidential - For Research Use Only", fontsize=8, color='#A0AEC0')
            pdf.savefig(fig2, bbox_inches='tight')
            plt.close(fig2)

        # Page 3+: 工作簿已保存图表,每张一页(kaleido 渲染)—— zcode
        for idx, ch in enumerate(charts_plotly or []):
            try:
                png_bytes = export_chart_image(
                    chart_plotly_json=ch.get('plotly') or ch.get('plotly_json') or {},
                    format='png', width=1000, height=750
                )
                img = Image.open(io.BytesIO(png_bytes))
                figc, axc = plt.subplots(figsize=(8.5, 11))
                axc.axis('off')
                axc.text(0.5, 0.95, f"工作簿图表 {idx + 1}: {ch.get('title', '')}",
                         fontsize=13, fontweight='bold', ha='center', color='#1A365D')
                axc.plot([0.05, 0.95], [0.92, 0.92], color='#CBD5E0', lw=1, transform=axc.transAxes)
                ax_img = figc.add_axes([0.08, 0.18, 0.84, 0.7])
                ax_img.imshow(img)
                ax_img.axis('off')
                axc.text(0.05, 0.03, "LabVault - Confidential - For Research Use Only", fontsize=8, color='#A0AEC0')
                pdf.savefig(figc, bbox_inches='tight')
                plt.close(figc)
            except Exception as chart_err:
                # 单图渲染失败不阻断整份报告
                print(f"[export] 工作簿图表 {idx + 1} 渲染失败: {chart_err}")

    buffer.seek(0)
    return buffer


# ─── PDF 报告导出 ─────────────────────────────────────────────────────────────

def export_pdf_report(
    title: str = "实验数据与统计分析报告",
    project_name: str = "Default Project",
    dataset_name: str = "Dataset",
    stats_results: Optional[List[Dict[str, Any]]] = None,
    table_data: Optional[List[Dict[str, Any]]] = None,
    chart_image_base64: Optional[str] = None,
    charts_plotly: Optional[List[Dict[str, Any]]] = None,
    notes: str = ""
) -> io.BytesIO:
    """
    生成高规格科研 PDF 报告
    :param title: 报告主标题
    :param project_name: 项目名称
    :param dataset_name: 数据集名称
    :param stats_results: 统计分析结果字典列表
    :param table_data: 样本数据预览列表
    :param chart_image_base64: 前端传入的图表 PNG/JPEG Base64 编码字符串
    :param charts_plotly: 工作簿已保存图表列表 [{title, plotly}] —— 由 ZCode 添加,
                          每张图用 kaleido 渲染为独立 PDF 页
    :param notes: 实验备忘录与结论
    :return: BytesIO PDF 字节流
    """
    if not HAS_REPORTLAB:
        return _export_pdf_matplotlib(
            title=title,
            project_name=project_name,
            dataset_name=dataset_name,
            stats_results=stats_results,
            table_data=table_data,
            chart_image_base64=chart_image_base64,
            charts_plotly=charts_plotly,
            notes=notes
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#1A365D")
    secondary_color = colors.HexColor("#2B6CB0")
    light_bg = colors.HexColor("#EDF2F7")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=12
    )

    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=secondary_color,
        spaceBefore=14,
        spaceAfter=8
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#2D3748'),
        spaceAfter=6
    )

    bold_body_style = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    story = []

    # 1. 报告标题与元数据
    story.append(Paragraph(title, title_style))
    meta_info = [
        [Paragraph("<b>Project:</b>", body_style), Paragraph(project_name, body_style),
         Paragraph("<b>Date:</b>", body_style), Paragraph(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), body_style)],
        [Paragraph("<b>Dataset:</b>", body_style), Paragraph(dataset_name, body_style),
         Paragraph("<b>Generated By:</b>", body_style), Paragraph("LabVault Core Analytics", body_style)]
    ]
    meta_table = Table(meta_info, colWidths=[70, 180, 80, 170])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), light_bg),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # 2. 实验备忘录 / 结论
    if notes:
        story.append(Paragraph("1. 实验概述与结论 (Summary & Conclusion)", h2_style))
        story.append(Paragraph(notes.replace('\n', '<br/>'), body_style))
        story.append(Spacer(1, 10))

    # 3. 统计分析结果详情
    if stats_results:
        story.append(Paragraph("2. 统计学检验分析结果 (Statistical Analysis)", h2_style))
        for idx, res in enumerate(stats_results):
            test_type = res.get('test_type', res.get('type', res.get('test', f'Analysis {idx+1}')))
            conclusion = res.get('conclusion', 'Analysis completed.')
            
            story.append(Paragraph(f"<b>2.{idx+1} 分析项目: {test_type.upper()}</b>", bold_body_style))
            story.append(Paragraph(f"<b>结论判定:</b> {conclusion}", body_style))

            # 整理键值结果成表格
            summary_rows = [["指标 (Metric)", "数值 / 描述 (Value)"]]
            for k, v in res.items():
                if k in ['posthoc_tukey', 'posthoc_dunn', 'anova_table', 'fit_curve', 'data_points', 'roc_curve', 'timeline', 'survival_function']:
                    continue
                if isinstance(v, (int, float)):
                    val_str = f"{v:.4f}" if isinstance(v, float) else str(v)
                elif isinstance(v, dict):
                    continue
                else:
                    val_str = str(v)
                summary_rows.append([str(k), val_str])

            if len(summary_rows) > 1:
                t = Table(summary_rows[:15], colWidths=[180, 320])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), secondary_color),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0,0), (-1,-1), 9),
                    ('PADDING', (0,0), (-1,-1), 4),
                    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#A0AEC0')),
                    ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#EDF2F7')),
                ]))
                story.append(t)
                story.append(Spacer(1, 10))

    # 4. 图表展示
    if chart_image_base64:
        story.append(Paragraph("3. 实验图表展示 (Scientific Visualization)", h2_style))
        try:
            # 清理 base64 头部（若有 data:image/png;base64,）
            if ',' in chart_image_base64:
                chart_image_base64 = chart_image_base64.split(',', 1)[1]
            img_data = base64.b64decode(chart_image_base64)
            img_stream = io.BytesIO(img_data)
            rl_img = RLImage(img_stream, width=6.5*inch, height=4.0*inch)
            story.append(KeepTogether([rl_img]))
            story.append(Spacer(1, 10))
        except Exception as e:
            story.append(Paragraph(f"<i>[图表渲染异常: {e}]</i>", body_style))

    # 5. 数据样本预览表
    if table_data and len(table_data) > 0:
        story.append(Paragraph("4. 数据样本截取预览 (Data Sample Preview - First 10 rows)", h2_style))
        df_preview = pd.DataFrame(table_data).head(10)
        cols = list(df_preview.columns)[:8]  # 最多取前8列以适配版面
        header = [Paragraph(f"<b>{c}</b>", bold_body_style) for c in cols]
        rows = [header]
        for _, row in df_preview.iterrows():
            r = []
            for c in cols:
                val = row[c]
                val_str = f"{val:.3f}" if isinstance(val, float) else str(val if pd.notnull(val) else "-")
                r.append(Paragraph(val_str, body_style))
            rows.append(r)

        col_w = (6.8 * inch) / len(cols)
        data_table = Table(rows, colWidths=[col_w]*len(cols))
        data_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), light_bg),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 3),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        story.append(data_table)

    # 构建并输出
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer


# ─── SVG / PNG 图表导出 ────────────────────────────────────────────────────────

def export_chart_image(
    chart_plotly_json: Optional[Dict[str, Any]] = None,
    format: str = "svg",
    width: int = 800,
    height: int = 600,
    scale: float = 2.0
) -> bytes:
    """
    将 Plotly 图表导出为高分辨率 SVG 或 PNG 矢量/位图
    :param chart_plotly_json: Plotly 图表字典或 JSON 对象
    :param format: 'svg' / 'png' / 'jpeg' / 'pdf'
    :param width: 宽度像素
    :param height: 高度像素
    :param scale: 缩放因子（默认 2.0 相当于 300DPI 打印级别清晰度）
    :return: 字节数据
    """
    if not chart_plotly_json:
        raise ValueError("图表数据为空")

    import plotly.graph_objects as go
    fig = go.Figure(chart_plotly_json)
    
    # 尝试使用 kaleido 进行静态图像导出
    try:
        img_bytes = fig.to_image(format=format, width=width, height=height, scale=scale)
        return img_bytes
    except Exception as e:
        # 如果 kaleido 没安装或环境不支持，回退到生成可交互独立 html/svg 或提示
        if format.lower() == 'svg':
            # 尝试回退 matplotlib 或直接由 plotly 抛出带详情的提示
            try:
                import kaleido
                raise e
            except ImportError:
                # 构造简易包含 SVG 声明的占位或引导
                raise RuntimeError(f"SVG 导出需要 kaleido 引擎支持: {e}。建议前端使用 Plotly.toImage 导出或在后端安装 kaleido。")
        raise RuntimeError(f"图表转存图像失败: {str(e)}")


# ─── Excel 数据与分析综合导出 ──────────────────────────────────────────────────

def export_excel_workbook(
    dataset_records: Optional[List[Dict[str, Any]]] = None,
    dataset_name: str = "RawData",
    stats_analyses: Optional[List[Dict[str, Any]]] = None,
    descriptive_dict: Optional[Dict[str, Any]] = None
) -> io.BytesIO:
    """
    导出多页签精美 Excel 文件：
      - Sheet 1: 原始实验数据（带交替行色彩与冻结窗格）
      - Sheet 2: 描述性统计（均值, 标准差, SEM, 中位数, 95% CI）
      - Sheet 3: 假设检验与拟合分析明细
    """
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        workbook = writer.book

        # 1. 原始数据
        if dataset_records:
            df_raw = pd.DataFrame(dataset_records)
            sheet_title = (dataset_name[:28] if dataset_name else "Raw_Data").replace('/', '_')
            df_raw.to_excel(writer, sheet_name=sheet_title, index=False)
            
            # 美化原始数据表
            ws_raw = writer.sheets[sheet_title]
            ws_raw.views.sheetView[0].showGridLines = True
            ws_raw.freeze_panes = 'A2'

        # 2. 描述性统计表
        if descriptive_dict:
            df_desc = pd.DataFrame(descriptive_dict)
            df_desc.to_excel(writer, sheet_name="Descriptive_Stats")

        # 3. 统计学分析总结
        if stats_analyses:
            flat_analyses = []
            for item in stats_analyses:
                row = {
                    "Analysis_Type": item.get('test_type', item.get('type', item.get('test', 'General'))),
                    "Conclusion": item.get('conclusion', ''),
                    "P_Value": item.get('p_value_fmt', item.get('p_value', '')),
                    "Significant": item.get('significant', ''),
                    "Statistic": item.get('t_statistic', item.get('f_statistic', item.get('u_statistic', item.get('r_squared', ''))))
                }
                flat_analyses.append(row)
            df_analyses = pd.DataFrame(flat_analyses)
            df_analyses.to_excel(writer, sheet_name="Hypothesis_Tests", index=False)

    buffer.seek(0)
    return buffer
