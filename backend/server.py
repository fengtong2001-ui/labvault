"""
server.py — LabVault Flask 主服务
端口：5050
对标 GraphPad Prism 的完整科研数据管理与统计分析系统后端服务。
整合了数据库操作、统计学计算、Plotly 图表生成、多源数据导入与多格式导出。
"""

import os
import sys
import io
import json
import logging
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS

# 添加当前目录至 Python 路径
sys.path.insert(0, os.path.dirname(__file__))

import db
import stats
import charts
import import_data
import export

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger("LabVault-Server")

app = Flask(__name__)
# 允许跨域请求（支持 Electron / React 前端）
CORS(app, resources={r"/api/*": {"origins": "*"}})


# ─── 统一响应与异常处理 ────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "请求的资源未找到", "code": 404}), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"服务器内部异常: {str(e)}")
    return jsonify({"error": "服务器内部错误", "detail": str(e), "code": 500}), 500


# ─── 健康检查与系统信息 ────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health_check():
    """系统健康检查接口"""
    return jsonify({
        "status": "healthy",
        "service": "LabVault Scientific Backend",
        "version": "1.0.0",
        "port": 5050
    })


# ─── 项目管理 (Projects API) ──────────────────────────────────────────────────

@app.route('/api/projects', methods=['GET', 'POST'])
def handle_projects():
    """
    GET:  获取所有科研项目列表
    POST: 创建新科研项目
    """
    if request.method == 'GET':
        try:
            projects = db.list_projects()
            return jsonify({"status": "success", "data": projects})
        except Exception as e:
            logger.error(f"获取项目列表失败: {e}")
            return jsonify({"error": str(e)}), 500

    elif request.method == 'POST':
        try:
            payload = request.get_json(force=True) or {}
            name = payload.get('name')
            if not name or not name.strip():
                return jsonify({"error": "项目名称不能为空"}), 400
            desc = payload.get('description', '')
            proj = db.create_project(name=name.strip(), description=desc)
            return jsonify({"status": "success", "data": proj}), 201
        except Exception as e:
            logger.error(f"创建项目失败: {e}")
            return jsonify({"error": str(e)}), 500


@app.route('/api/projects/<int:project_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_project(project_id: int):
    """
    GET:    获取项目详情（含关联数据集）
    PUT:    更新项目名称与描述
    DELETE: 删除项目（级联删除全部数据集与图表）
    """
    if request.method == 'GET':
        proj = db.get_project(project_id)
        if not proj:
            return jsonify({"error": "项目不存在"}), 404
        datasets = db.list_datasets(project_id)
        proj['datasets'] = datasets
        return jsonify({"status": "success", "data": proj})

    elif request.method == 'PUT':
        payload = request.get_json(force=True) or {}
        name = payload.get('name')
        desc = payload.get('description')
        updated = db.update_project(project_id, name=name, description=desc)
        if not updated:
            return jsonify({"error": "更新失败或项目未找到"}), 404
        return jsonify({"status": "success", "data": updated})

    elif request.method == 'DELETE':
        success = db.delete_project(project_id)
        if not success:
            return jsonify({"error": "删除失败或项目未找到"}), 404
        return jsonify({"status": "success", "message": "项目删除成功"})


# ─── 数据集管理 (Datasets API) ────────────────────────────────────────────────

@app.route('/api/projects/<int:project_id>/datasets', methods=['GET', 'POST'])
def handle_datasets(project_id: int):
    """
    GET:  获取项目下的所有数据集
    POST: 在项目下新建/保存数据集
    """
    proj = db.get_project(project_id)
    if not proj:
        return jsonify({"error": "项目不存在"}), 404

    if request.method == 'GET':
        datasets = db.list_datasets(project_id)
        return jsonify({"status": "success", "data": datasets})

    elif request.method == 'POST':
        try:
            payload = request.get_json(force=True) or {}
            name = payload.get('name', '未命名数据集')
            data = payload.get('data', [])
            columns = payload.get('columns', [])
            desc = payload.get('description', '')
            source_file = payload.get('source_file', '')

            ds = db.create_dataset(
                project_id=project_id,
                name=name,
                data=data,
                columns=columns,
                description=desc,
                source_file=source_file
            )
            return jsonify({"status": "success", "data": ds}), 201
        except Exception as e:
            logger.error(f"创建数据集失败: {e}")
            return jsonify({"error": str(e)}), 500


@app.route('/api/datasets/<int:dataset_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_dataset(dataset_id: int):
    """
    GET:    获取单个数据集内容
    PUT:    更新数据集(名称/数据/列)—— 由 ZCode 添加:数据表格保存需要
    DELETE: 删除单个数据集
    """
    if request.method == 'GET':
        ds = db.get_dataset(dataset_id)
        if not ds:
            return jsonify({"error": "数据集不存在"}), 404
        return jsonify({"status": "success", "data": ds})

    elif request.method == 'PUT':
        try:
            payload = request.get_json(force=True) or {}
            ds = db.update_dataset(
                dataset_id,
                name=payload.get('name'),
                data=payload.get('data') if 'data' in payload else None,
                columns=payload.get('columns') if 'columns' in payload else None,
                description=payload.get('description'),
            )
            if not ds:
                return jsonify({"error": "数据集不存在"}), 404
            return jsonify({"status": "success", "data": ds})
        except Exception as e:
            logger.error(f"更新数据集失败: {e}")
            return jsonify({"error": str(e)}), 500

    elif request.method == 'DELETE':
        success = db.delete_dataset(dataset_id)
        if not success:
            return jsonify({"error": "数据集不存在或删除失败"}), 404
        return jsonify({"status": "success", "message": "数据集删除成功"})


# ─── 数据导入接口 (Import API) ────────────────────────────────────────────────

@app.route('/api/import', methods=['POST'])
def import_data_endpoint():
    """
    支持两类导入形式：
    1. multipart/form-data 文件上传（file 字段）
    2. application/json 直接传递文本或文件绝对路径（filePath 字段）
    """
    try:
        if 'file' in request.files:
            uploaded_file = request.files['file']
            filename = uploaded_file.filename
            file_bytes = uploaded_file.read()
            sheet_name = request.form.get('sheet_name', 0)
            res = import_data.import_dataset_from_file(file_bytes, filename=filename, sheet_name=sheet_name)
            return jsonify(res)
        
        # JSON 格式传参（例如通过 Electron 传文件路径）
        payload = request.get_json(force=True, silent=True) or {}
        file_path = payload.get('filePath') or payload.get('file_path')
        if file_path and os.path.exists(file_path):
            filename = os.path.basename(file_path)
            sheet_name = payload.get('sheet_name', 0)
            res = import_data.import_dataset_from_file(file_path, filename=filename, sheet_name=sheet_name)
            return jsonify(res)

        return jsonify({"error": "未提供上传文件 (file) 或有效的文件路径 (filePath)"}), 400

    except Exception as e:
        logger.error(f"导入数据失败: {str(e)}")
        return jsonify({"error": f"导入失败: {str(e)}"}), 500


# ─── 统计分析接口 (Stats API) ─────────────────────────────────────────────────

@app.route('/api/stats/descriptive', methods=['POST'])
def api_descriptive():
    """描述性统计量与正态性检验"""
    try:
        payload = request.get_json(force=True) or {}
        data = payload.get('data', [])
        if not data:
            return jsonify({"error": "数据数组不能为空"}), 400
        desc = stats.descriptive_stats(data)
        norm = stats.normality_test(data)
        return jsonify({"status": "success", "descriptive": desc, "normality": norm})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/ttest', methods=['POST'])
def api_ttest():
    """t 检验接口（单样本、独立样本、配对样本）"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.ttest(params)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        logger.error(f"t检验计算失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/anova', methods=['POST'])
def api_anova():
    """ANOVA 方差分析接口（单因素、双因素、重复测量）"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.anova(params)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        logger.error(f"ANOVA 计算失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/nonparam', methods=['POST'])
def api_nonparam():
    """非参数检验接口（Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman）"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.nonparam_test(params)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        logger.error(f"非参数检验失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/regression', methods=['POST'])
def api_regression():
    """回归分析接口（简单/多元线性回归、多项式回归、逻辑斯蒂回归）"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.regression(params)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        logger.error(f"回归分析失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/survival', methods=['POST'])
def api_survival():
    """生存分析接口（Kaplan-Meier, Log-rank, Cox回归）"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.survival_analysis(params)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        logger.error(f"生存分析失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/roc', methods=['POST'])
def api_roc():
    """ROC 曲线分析与最优阈值求解"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.roc_analysis(params)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        logger.error(f"ROC 分析失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/ic50', methods=['POST'])
def api_ic50():
    """IC50/EC50 非线性曲线拟合（4PL / 3PL 模型）"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.ic50_fit(params)
        if "error" in res:
            return jsonify({"error": res["error"]}), 400
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        logger.error(f"IC50 拟合失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/correlation', methods=['POST'])
def api_correlation():
    """相关性分析（Pearson 与 Spearman）"""
    try:
        params = request.get_json(force=True) or {}
        res = stats.correlation(params)
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/multicomp', methods=['POST'])
def api_multicomp():
    """多重比较 p 值校正（Bonferroni, BH/FDR, Holm 等）"""
    try:
        payload = request.get_json(force=True) or {}
        p_vals = payload.get('p_values', [])
        method = payload.get('method', 'fdr_bh')
        res = stats.multiple_correction(p_vals, method=method)
        return jsonify({"status": "success", "result": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── 图表生成接口 (Charts API) ────────────────────────────────────────────────

@app.route('/api/charts/generate', methods=['POST'])
def api_chart_generate():
    """
    根据参数生成 Plotly JSON 结构供前端交互渲染
    """
    try:
        params = request.get_json(force=True) or {}
        res = charts.generate_chart(params)
        if "error" in res:
            return jsonify(res), 400
        return jsonify(res)
    except Exception as e:
        logger.error(f"图表生成失败: {e}")
        return jsonify({"error": str(e)}), 500


# ─── 导出接口 (Export API) ────────────────────────────────────────────────────

@app.route('/api/export/pdf', methods=['POST'])
def api_export_pdf():
    """导出高规格专业 PDF 实验分析报告"""
    try:
        payload = request.get_json(force=True) or {}
        title = payload.get('title', 'LabVault 实验分析报告')
        project_name = payload.get('project_name', 'Default Project')
        dataset_name = payload.get('dataset_name', 'Dataset')
        stats_results = payload.get('stats_results', [])
        table_data = payload.get('table_data', [])
        chart_image_base64 = payload.get('chart_image_base64')
        charts_plotly = payload.get('charts_plotly')
        notes = payload.get('notes', '')

        pdf_stream = export.export_pdf_report(
            title=title,
            project_name=project_name,
            dataset_name=dataset_name,
            stats_results=stats_results,
            table_data=table_data,
            chart_image_base64=chart_image_base64,
            charts_plotly=charts_plotly,
            notes=notes
        )

        return send_file(
            pdf_stream,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"LabVault_Report_{dataset_name}.pdf"
        )
    except Exception as e:
        logger.error(f"PDF 导出失败: {e}")
        return jsonify({"error": f"PDF 导出失败: {str(e)}"}), 500


@app.route('/api/export/svg', methods=['POST'])
def api_export_svg():
    """导出高清晰矢量图 (SVG / PNG)"""
    try:
        payload = request.get_json(force=True) or {}
        chart_plotly_json = payload.get('plotly_json')
        img_format = payload.get('format', 'svg').lower()
        width = int(payload.get('width', 800))
        height = int(payload.get('height', 600))

        # 若前端直接传递已经生成的 svg 文本或 base64
        raw_svg = payload.get('svg_content')
        if raw_svg:
            return Response(
                raw_svg,
                mimetype='image/svg+xml',
                headers={"Content-Disposition": "attachment;filename=chart.svg"}
            )

        img_bytes = export.export_chart_image(
            chart_plotly_json=chart_plotly_json,
            format=img_format,
            width=width,
            height=height
        )

        mime_type = 'image/svg+xml' if img_format == 'svg' else f'image/{img_format}'
        return send_file(
            io.BytesIO(img_bytes),
            mimetype=mime_type,
            as_attachment=True,
            download_name=f"chart.{img_format}"
        )
    except Exception as e:
        logger.error(f"图表图像导出异常: {e}")
        return jsonify({"error": f"图表导出失败: {str(e)}"}), 500


@app.route('/api/export/excel', methods=['POST'])
def api_export_excel():
    """导出结构化实验与统计分析 Excel 文件"""
    try:
        payload = request.get_json(force=True) or {}
        dataset_records = payload.get('data', [])
        dataset_name = payload.get('name', 'RawData')
        stats_analyses = payload.get('analyses', [])
        descriptive = payload.get('descriptive', {})

        excel_stream = export.export_excel_workbook(
            dataset_records=dataset_records,
            dataset_name=dataset_name,
            stats_analyses=stats_analyses,
            descriptive_dict=descriptive
        )

        return send_file(
            excel_stream,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f"{dataset_name}_analysis.xlsx"
        )
    except Exception as e:
        logger.error(f"Excel 导出异常: {e}")
        return jsonify({"error": f"Excel 导出失败: {str(e)}"}), 500


# ─── 分析结果与图表落库 (由 ZCode 添加:Prism 式结果工作表) ───────────────────

@app.route('/api/analyses', methods=['POST', 'GET'])
def api_analyses():
    """
    POST: 保存统计分析结果 { analysis_type, params, result, dataset_id, project_id }
    GET:  按 dataset_id / project_id 列出分析结果
    """
    if request.method == 'POST':
        try:
            payload = request.get_json(force=True) or {}
            analysis = db.save_analysis(
                analysis_type=payload.get('analysis_type') or payload.get('type') or 'unknown',
                params=payload.get('params') or {},
                result=payload.get('result') or {},
                dataset_id=payload.get('dataset_id'),
                project_id=payload.get('project_id'),
            )
            return jsonify({"status": "success", "data": analysis}), 201
        except Exception as e:
            logger.error(f"保存分析结果失败: {e}")
            return jsonify({"error": str(e)}), 500

    ds_id = request.args.get('dataset_id', type=int)
    proj_id = request.args.get('project_id', type=int)
    return jsonify({"status": "success",
                    "data": db.list_analyses(project_id=proj_id, dataset_id=ds_id)})


@app.route('/api/analyses/<int:analysis_id>', methods=['DELETE'])
def api_delete_analysis(analysis_id: int):
    """删除分析结果 —— 由 ZCode 添加(工作簿条目管理)"""
    try:
        if not db.delete_analysis(analysis_id):
            return jsonify({"error": "分析结果不存在"}), 404
        return jsonify({"status": "success", "message": "分析结果已删除"})
    except Exception as e:
        logger.error(f"删除分析结果失败: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/charts', methods=['POST', 'GET'])
def api_charts():
    """
    POST: 保存图表 { chart_type, plotly_json, title, dataset_id, project_id, analysis_id }
    GET:  按 dataset_id / project_id 列出图表
    """
    if request.method == 'POST':
        try:
            payload = request.get_json(force=True) or {}
            chart = db.save_chart(
                chart_type=payload.get('chart_type') or 'unknown',
                plotly_json=payload.get('plotly_json') or {},
                title=payload.get('title') or '',
                dataset_id=payload.get('dataset_id'),
                project_id=payload.get('project_id'),
                analysis_id=payload.get('analysis_id'),
            )
            return jsonify({"status": "success", "data": chart}), 201
        except Exception as e:
            logger.error(f"保存图表失败: {e}")
            return jsonify({"error": str(e)}), 500

    ds_id = request.args.get('dataset_id', type=int)
    proj_id = request.args.get('project_id', type=int)
    return jsonify({"status": "success",
                    "data": db.list_charts(project_id=proj_id, dataset_id=ds_id)})


@app.route('/api/charts/<int:chart_id>', methods=['DELETE'])
def api_delete_chart(chart_id: int):
    """删除图表 —— 由 ZCode 添加(工作簿条目管理)"""
    try:
        if not db.delete_chart(chart_id):
            return jsonify({"error": "图表不存在"}), 404
        return jsonify({"status": "success", "message": "图表已删除"})
    except Exception as e:
        logger.error(f"删除图表失败: {e}")
        return jsonify({"error": str(e)}), 500


# ─── 主服务启动 ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    # 确保数据库已初始化
    db.init_db()
    port = int(os.environ.get('PORT', 5050))
    logger.info(f"启动 LabVault 后端服务，正在监听端口 {port} ...")
    app.run(host='0.0.0.0', port=port, debug=False)
