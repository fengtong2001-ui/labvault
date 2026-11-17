// datasetStats.js — 数据集 → 统计/图表 的通用映射(GraphPad 式整合)
// 由 ZCode 添加:让数据表格、统计分析、图表构建三个模块共享同一份数据集上下文
import { datasetsApi } from './api';

export const isNumeric = (v) =>
  v !== null && v !== undefined && v !== '' && !isNaN(Number(v)) && isFinite(Number(v));

export function classifyColumns(columns, data) {
  const n = columns?.length || 0;
  const numeric = [];
  const categorical = [];
  for (let c = 0; c < n; c++) {
    const vals = (data || []).map((r) => (Array.isArray(r) ? r[c] : r?.[columns[c]])).filter((v) => v !== '' && v !== null && v !== undefined);
    if (vals.length === 0) continue;
    const numRatio = vals.filter(isNumeric).length / vals.length;
    (numRatio >= 0.8 ? numeric : categorical).push(c);
  }
  return { categorical, numeric };
}

export function toNum(v) {
  const n = Number(v);
  return isNumeric(v) ? n : NaN;
}

/** 分组聚合:catIdx 列的每个取值 → valIdx 列的数值数组 */
export function groupValues(data, catIdx, valIdx) {
  const groups = {};
  for (const r of data || []) {
    const k = String(Array.isArray(r) ? r[catIdx] : r?.[catIdx] ?? '全部');
    const v = toNum(Array.isArray(r) ? r[valIdx] : r?.[valIdx]);
    if (!isNaN(v)) (groups[k] = groups[k] || []).push(v);
  }
  return groups;
}

export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
export const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

/** 从数据集推导 t 检验输入:分类列+数值列 → 按前两个组拆;两个数值列 → 各成一列 */
export function ttestFromDataset(ds) {
  const columns = typeof ds.columns === 'string' ? safeParse(ds.columns, []) : ds.columns || [];
  const data = typeof ds.data === 'string' ? safeParse(ds.data, []) : ds.data || [];
  const { categorical, numeric } = classifyColumns(columns, data);
  if (categorical.length && numeric.length) {
    const groups = groupValues(data, categorical[0], numeric[0]);
    const names = Object.keys(groups);
    if (names.length >= 2) {
      return { g1: groups[names[0]], g2: groups[names[1]], names: names.slice(0, 2), groups, dsName: ds.name, columns };
    }
  }
  if (numeric.length >= 2) {
    const g1 = (data || []).map((r) => toNum(Array.isArray(r) ? r[numeric[0]] : r?.[numeric[0]])).filter((v) => !isNaN(v));
    const g2 = (data || []).map((r) => toNum(Array.isArray(r) ? r[numeric[1]] : r?.[numeric[1]])).filter((v) => !isNaN(v));
    if (g1.length && g2.length) {
      return { g1, g2, names: [columns[numeric[0]], columns[numeric[1]]], dsName: ds.name, columns };
    }
  }
  return null;
}

/** 图表参数构建:按 chartType 从真实数据集产出后端 schema;失败返回 null(调用方回退演示) */
export function chartParamsFromDataset(ds, chartType, meta = {}) {
  const columns = typeof ds.columns === 'string' ? safeParse(ds.columns, []) : ds.columns || [];
  const data = typeof ds.data === 'string' ? safeParse(ds.data, []) : ds.data || [];
  if (!data.length || !columns.length) return null;
  const { categorical, numeric } = classifyColumns(columns, data);
  const base = { chart_type: chartType, title: meta.title || ds.name, x_label: meta.xLabel, y_label: meta.yLabel };
  const cats = categorical.map((i) => columns[i]);

  if (chartType === 'bar' || chartType === 'error_bar') {
    if (categorical.length && numeric.length) {
      // 每个数值列一个系列,按分类列聚合为 均值±SD(GraphPad 出版风)
      const uniq = [...new Set(data.map((r) => String(Array.isArray(r) ? r[categorical[0]] : r?.[categorical[0]])))];
      const series = numeric.slice(0, 4).map((vi) => {
        const byCat = uniq.map((c) => {
          const vals = data.filter((r) => String(Array.isArray(r) ? r[categorical[0]] : r?.[categorical[0]]) === c)
            .map((r) => toNum(Array.isArray(r) ? r[vi] : r?.[vi])).filter((v) => !isNaN(v));
          return { y: mean(vals), error_y: sd(vals) };
        });
        return { name: String(columns[vi]), x: uniq, y: byCat.map((d) => d.y), error_y: byCat.map((d) => d.error_y) };
      });
      return { ...base, chart_type: 'bar', series, barmode: meta.barmode || 'group' };
    }
    return null;
  }
  if (chartType === 'line' || chartType === 'scatter') {
    if (numeric.length >= 2) {
      const xs = data.map((r) => toNum(Array.isArray(r) ? r[numeric[0]] : r?.[numeric[0]]));
      const series = numeric.slice(1, 4).map((vi, k) => ({
        name: String(columns[vi]),
        x: xs,
        y: data.map((r) => toNum(Array.isArray(r) ? r[vi] : r?.[vi])),
        ...(chartType === 'scatter' && k === 0 ? { trendline: true } : {}),
      }));
      return { ...base, chart_type: chartType, series };
    }
    return null;
  }
  if (chartType === 'box' || chartType === 'violin') {
    if (categorical.length && numeric.length) {
      const groups = groupValues(data, categorical[0], numeric[0]);
      return { ...base, chart_type: chartType, groups: Object.entries(groups).map(([name, values]) => ({ name, values })) };
    }
    if (numeric.length) {
      return { ...base, chart_type: chartType, groups: [{ name: String(columns[numeric[0]]), values: data.map((r) => toNum(Array.isArray(r) ? r[numeric[0]] : r?.[numeric[0]])).filter((v) => !isNaN(v)) }] };
    }
    return null;
  }
  // 特殊科研图型:按列名语义识别(浓度-效应 / 时间-事件 / 标签-评分)—— zcode
  // 这三类是"先统计后画图"两段式:返回 __statEndpoint + payload,由调用方先走 stats API
  if (chartType === 'ic50') {
    const colIdx = findColByNames(columns, ['浓度', 'concentration', 'conc', '剂量', 'dose', 'inhibitor'])
      ?? (numeric.length >= 1 ? numeric[0] : null);
    const respIdx = findColByNames(columns, ['抑制率', '响应', 'response', '活性', 'viability', '效应'])
      ?? (numeric.length >= 2 ? numeric[1] : null);
    if (colIdx !== null && respIdx !== null) {
      const x = data.map((r) => toNum(Array.isArray(r) ? r[colIdx] : r?.[colIdx])).filter((v) => !isNaN(v));
      const y = data.map((r) => toNum(Array.isArray(r) ? r[respIdx] : r?.[respIdx])).filter((v) => !isNaN(v));
      if (x.length >= 4 && x.length === y.length) {
        return { __statEndpoint: 'ic50', payload: { x, y } };
      }
    }
    return null;
  }
  if (chartType === 'survival') {
    const timeIdx = findColByNames(columns, ['时间', 'time', '月', 'months', 'days', '随访']);
    const eventIdx = findColByNames(columns, ['事件', 'event', 'status', '终点', '结局']);
    const groupIdx = categorical.length ? categorical[0] : findColByNames(columns, ['组', 'group', 'treatment']);
    if (timeIdx !== null && eventIdx !== null) {
      const duration = data.map((r) => toNum(Array.isArray(r) ? r[timeIdx] : r?.[timeIdx])).filter((v) => !isNaN(v));
      const event = data.map((r) => toNum(Array.isArray(r) ? r[eventIdx] : r?.[eventIdx])).filter((v) => !isNaN(v));
      const groups = groupIdx !== null && groupIdx !== timeIdx && groupIdx !== eventIdx
        ? data.map((r) => String(Array.isArray(r) ? r[groupIdx] : r?.[groupIdx] ?? '全部'))
        : undefined;
      if (duration.length && duration.length === event.length) {
        return { __statEndpoint: 'survival', payload: { type: 'kaplan_meier', duration, event, ...(groups ? { groups } : {}) } };
      }
    }
    return null;
  }
  if (chartType === 'roc') {
    const labelIdx = findColByNames(columns, ['标签', 'label', '组别', '诊断', '金标准', 'true', 'y_true', '患病'])
      ?? (categorical.length ? categorical[0] : null);
    const scoreIdx = findColByNames(columns, ['评分', 'score', '概率', 'probability', '预测值', 'y_score'])
      ?? (numeric.length ? numeric[numeric.length - 1] : null);
    if (labelIdx !== null && scoreIdx !== null && labelIdx !== scoreIdx) {
      const yTrue = data.map((r) => toNum(Array.isArray(r) ? r[labelIdx] : r?.[labelIdx])).filter((v) => !isNaN(v));
      const yScore = data.map((r) => toNum(Array.isArray(r) ? r[scoreIdx] : r?.[scoreIdx])).filter((v) => !isNaN(v));
      if (yTrue.length >= 4 && yTrue.length === yScore.length) {
        return { __statEndpoint: 'roc', payload: { y_true: yTrue, y_score: yScore } };
      }
    }
    return null;
  }
  return null;
}

/** 按候选关键词(不区分大小写)找列下标,找不到返回 null */
function findColByNames(columns, keywords) {
  if (!columns?.length) return null;
  for (const kw of keywords) {
    const i = columns.findIndex((c) => String(c).toLowerCase().includes(kw.toLowerCase()));
    if (i >= 0) return i;
  }
  return null;
}

function safeParse(s, dflt) {
  try { return JSON.parse(s); } catch { return dflt; }
}

/** 载入数据集详情(带降级) */
export async function loadDataset(projectId, datasetId) {
  const res = await datasetsApi.get(projectId, datasetId);
  const ds = res?.data || res?.dataset || res;
  return ds && (ds.data || ds.columns) ? ds : null;
}
