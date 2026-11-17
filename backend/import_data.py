"""
import_data.py — LabVault 数据导入模块
支持 CSV、Excel (.xlsx, .xls)、JSON 以及图片（元数据/Base64）的导入与结构化解析。
包含编码自动检测、分隔符推断、缺失值清洗和数据类型推断功能。
"""

from __future__ import annotations
import os
import io
import json
import base64
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List, Optional
from PIL import Image


def infer_column_types(df: pd.DataFrame) -> List[Dict[str, str]]:
    """
    推断 DataFrame 各列的数据类型（用于前端展示和统计类型校验）
    返回格式: [{"name": "col1", "type": "numeric"|"string"|"datetime"|"boolean"}]
    """
    col_info = []
    for col in df.columns:
        series = df[col]
        # 判断数值型
        if pd.api.types.is_numeric_dtype(series):
            c_type = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            c_type = "datetime"
        elif pd.api.types.is_bool_dtype(series):
            c_type = "boolean"
        else:
            # 尝试转换数值或日期
            non_null = series.dropna()
            if len(non_null) > 0:
                try:
                    pd.to_numeric(non_null)
                    c_type = "numeric"
                except (ValueError, TypeError):
                    c_type = "string"
            else:
                c_type = "string"
        col_info.append({"name": str(col), "type": c_type})
    return col_info


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    清洗 DataFrame：
    - 去除全空行与全空列
    - 将 NaN / Inf / -Inf 替换为 None（以便顺利 JSON 序列化）
    - 确保列名为字符串且不重复
    """
    # 丢弃全空行与列
    df = df.dropna(how='all').dropna(axis=1, how='all')

    # 处理重复列名
    cols = []
    col_counts = {}
    for col in df.columns:
        col_name = str(col).strip() if pd.notnull(col) else "Column"
        if col_name in col_counts:
            col_counts[col_name] += 1
            col_name = f"{col_name}_{col_counts[col_name]}"
        else:
            col_counts[col_name] = 0
        cols.append(col_name)
    df.columns = cols

    # 替换 Inf 和 -Inf 为 NaN，再由后续处理为 None
    df = df.replace([np.inf, -np.inf], np.nan)
    return df


def parse_csv(
    file_bytes_or_path: Any,
    delimiter: Optional[str] = None,
    encoding: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]], Dict[str, Any]]:
    """
    解析 CSV 文件内容
    :param file_bytes_or_path: 文件字节流、文件对象或路径
    :param delimiter: 分隔符（可选，不传则自动推断）
    :param encoding: 编码（默认依次尝试 utf-8, gbk, gb18030, latin1）
    """
    encodings_to_try = [encoding] if encoding else ['utf-8', 'gbk', 'gb18030', 'utf-8-sig', 'latin1']
    
    # 如果是 bytes，包装为 BytesIO
    if isinstance(file_bytes_or_path, bytes):
        raw_bytes = file_bytes_or_path
    elif hasattr(file_bytes_or_path, 'read'):
        raw_bytes = file_bytes_or_path.read()
    elif isinstance(file_bytes_or_path, str) and os.path.exists(file_bytes_or_path):
        with open(file_bytes_or_path, 'rb') as f:
            raw_bytes = f.read()
    else:
        raise ValueError("无效的 CSV 文件输入")

    last_error = None
    df = None
    for enc in encodings_to_try:
        try:
            stream = io.BytesIO(raw_bytes)
            # 使用 Python 引擎以便自动嗅探分隔符
            df = pd.read_csv(stream, sep=delimiter, engine='python', encoding=enc)
            break
        except Exception as e:
            last_error = e
            continue

    if df is None:
        raise ValueError(f"无法读取 CSV 文件，解码尝试均失败: {last_error}")

    df = clean_dataframe(df)
    columns = infer_column_types(df)

    # 转换数值类型列为 float/int，其余为普通值
    records = df.where(pd.notnull(df), None).to_dict(orient='records')
    metadata = {
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": [c["name"] for c in columns]
    }
    return records, columns, metadata


def parse_excel(
    file_bytes_or_path: Any,
    sheet_name: Optional[Any] = 0
) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]], Dict[str, Any]]:
    """
    解析 Excel 文件（.xlsx, .xls）
    :param file_bytes_or_path: 文件字节流、文件对象或路径
    :param sheet_name: 工作表名称或索引（默认第 0 个）
    """
    try:
        if isinstance(file_bytes_or_path, bytes):
            bio = io.BytesIO(file_bytes_or_path)
            excel_file = pd.ExcelFile(bio, engine='openpyxl')
        elif hasattr(file_bytes_or_path, 'read'):
            bio = io.BytesIO(file_bytes_or_path.read())
            excel_file = pd.ExcelFile(bio, engine='openpyxl')
        else:
            excel_file = pd.ExcelFile(file_bytes_or_path, engine='openpyxl')

        sheet_names = excel_file.sheet_names
        target_sheet = sheet_name if sheet_name in sheet_names else sheet_names[0]
        df = excel_file.parse(target_sheet)
    except Exception as e:
        # 回退尝试 xlrd 引擎
        try:
            if isinstance(file_bytes_or_path, bytes):
                bio = io.BytesIO(file_bytes_or_path)
                excel_file = pd.ExcelFile(bio)
            else:
                excel_file = pd.ExcelFile(file_bytes_or_path)
            sheet_names = excel_file.sheet_names
            target_sheet = sheet_name if sheet_name in sheet_names else sheet_names[0]
            df = excel_file.parse(target_sheet)
        except Exception as e2:
            raise ValueError(f"Excel 读取失败: {e}; 备选引擎失败: {e2}")

    df = clean_dataframe(df)
    columns = infer_column_types(df)
    records = df.where(pd.notnull(df), None).to_dict(orient='records')

    metadata = {
        "sheet_names": sheet_names,
        "current_sheet": target_sheet,
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": [c["name"] for c in columns]
    }
    return records, columns, metadata


def parse_image(file_bytes_or_path: Any, filename: str = '') -> Dict[str, Any]:
    """
    解析实验图片（如 Western Blot、荧光显微镜胶片图、凝胶图谱等）
    提取图像基础尺寸、色彩模式、DPI 并生成 base64 预览数据
    """
    try:
        if isinstance(file_bytes_or_path, bytes):
            img_bytes = file_bytes_or_path
            img = Image.open(io.BytesIO(img_bytes))
        elif hasattr(file_bytes_or_path, 'read'):
            img_bytes = file_bytes_or_path.read()
            img = Image.open(io.BytesIO(img_bytes))
        else:
            with open(file_bytes_or_path, 'rb') as f:
                img_bytes = f.read()
            img = Image.open(io.BytesIO(img_bytes))

        width, height = img.size
        mode = img.mode
        img_format = img.format or (os.path.splitext(filename)[1].replace('.', '').upper() if filename else "PNG")
        dpi = img.info.get('dpi', (72, 72))

        b64_str = base64.b64encode(img_bytes).decode('utf-8')
        mime_type = f"image/{img_format.lower()}" if img_format else "image/png"

        return {
            "filename": filename,
            "format": img_format,
            "width": width,
            "height": height,
            "mode": mode,
            "dpi": dpi,
            "data_url": f"data:{mime_type};base64,{b64_str}",
            "size_bytes": len(img_bytes)
        }
    except Exception as e:
        raise ValueError(f"图片读取失败: {str(e)}")


def import_dataset_from_file(
    file_storage_or_path: Any,
    filename: str = '',
    sheet_name: Optional[Any] = 0
) -> Dict[str, Any]:
    """
    自动识别文件扩展名并完成数据集导入的主函数
    返回统一结构：
    {
        "status": "success",
        "type": "table" | "image",
        "data": [...],
        "columns": [...],
        "metadata": {...}
    }
    """
    name_lower = filename.lower()
    
    if name_lower.endswith('.csv') or name_lower.endswith('.txt'):
        records, cols, meta = parse_csv(file_storage_or_path)
        return {
            "status": "success",
            "type": "table",
            "data": records,
            "columns": cols,
            "metadata": meta
        }
    elif name_lower.endswith(('.xlsx', '.xls', '.xlsm')):
        records, cols, meta = parse_excel(file_storage_or_path, sheet_name=sheet_name)
        return {
            "status": "success",
            "type": "table",
            "data": records,
            "columns": cols,
            "metadata": meta
        }
    elif name_lower.endswith(('.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp')):
        img_meta = parse_image(file_storage_or_path, filename=filename)
        return {
            "status": "success",
            "type": "image",
            "data": [img_meta],
            "columns": [{"name": "Image", "type": "image"}],
            "metadata": img_meta
        }
    elif name_lower.endswith('.json'):
        if isinstance(file_storage_or_path, bytes):
            raw = file_storage_or_path.decode('utf-8')
        elif hasattr(file_storage_or_path, 'read'):
            raw = file_storage_or_path.read().decode('utf-8')
        else:
            with open(file_storage_or_path, 'r', encoding='utf-8') as f:
                raw = f.read()
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            df = pd.DataFrame(parsed)
            df = clean_dataframe(df)
            cols = infer_column_types(df)
            records = df.where(pd.notnull(df), None).to_dict(orient='records')
            return {
                "status": "success",
                "type": "table",
                "data": records,
                "columns": cols,
                "metadata": {"row_count": len(df), "column_count": len(df.columns)}
            }
        else:
            return {
                "status": "success",
                "type": "json",
                "data": parsed,
                "columns": [],
                "metadata": {}
            }
    else:
        # 默认尝试 CSV
        try:
            records, cols, meta = parse_csv(file_storage_or_path)
            return {
                "status": "success",
                "type": "table",
                "data": records,
                "columns": cols,
                "metadata": meta
            }
        except Exception:
            raise ValueError(f"不支持的文件格式: {filename}")
