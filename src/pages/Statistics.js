import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Select,
  MenuItem, FormControl, InputLabel, Tabs, Tab, Stack, Chip,
  Divider, Card, CardContent, Alert, CircularProgress, Tooltip,
  RadioGroup, FormControlLabel, Radio, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScienceIcon from '@mui/icons-material/Science';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DownloadIcon from '@mui/icons-material/Download';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadDataset, ttestFromDataset } from '../utils/datasetStats';
import { statsApi, datasetsApi, projectsApi, analysesApi, downloadBlob } from '../utils/api';
import StatResults from '../components/StatResults';

// 统计方法定义
const METHODS = [
  { id: 'ttest', label: 't 检验 (t-test)', desc: '比较两组样本均值差异（独立/配对）' },
  { id: 'anova', label: '方差分析 (ANOVA)', desc: '比较三组及以上样本均值及事后多重检验' },
  { id: 'nonparam', label: '非参数检验', desc: 'Mann-Whitney / Wilcoxon / Kruskal-Wallis' },
  { id: 'regression', label: '回归分析', desc: '线性回归及多项式曲线拟合' },
  { id: 'ic50', label: 'IC50/EC50 拟合', desc: '四参数 4PL 剂量-反应非线性拟合' },
  { id: 'survival', label: '生存分析', desc: 'Kaplan-Meier 累积生存率与 Log-rank 检验' },
  { id: 'roc', label: 'ROC 曲线分析', desc: '诊断指标敏感度、特异度及 AUC 评估' },
];

// 后端统计结果(平铺科学字段)→ 前端 UI 形状 {method, interpretation, summary, comparisons}
// 由 ZCode 添加:后端各检验统一返回平铺字段,这里做一次通用映射
const STAT_LABELS = {
  test_name: '检验方法', t_statistic: '统计量 t', t_value: '统计量 t',
  f_statistic: '统计量 F', h_statistic: '统计量 H', u_statistic: '统计量 U',
  w_statistic: '统计量 W', q_statistic: '统计量 Q', chi2_statistic: '统计量 χ²',
  df: '自由度 df', df1: '自由度 df1', df2: '自由度 df2',
  p_value: 'p 值', p_value_fmt: 'p 值', adj_p_value: '校正后 p 值',
  mean_diff: '均值差', cohens_d: "效应量 Cohen's d", effect_size_label: '效应量评级',
  significance: '显著性', significant: '是否显著', conclusion: '结论',
  equal_variance: '方差齐性', levene_stat: 'Levene 统计量', levene_p: 'Levene p 值',
  auc: 'AUC (曲线下面积)', youden: '约登指数', cutoff: '最佳截断值',
  ic50: 'IC50', ec50: 'EC50', hill_slope: 'Hill 斜率', r_squared: 'R²', r2: 'R²',
  slope: '斜率', intercept: '截距', log_ic50: 'log(IC50)', top: 'Top', bottom: 'Bottom',
  median_survival: '中位生存期', f_value: '统计量 F',
};
const STAT_SKIP = new Set(['test_type', 'alternative', 'alpha', 'threshold_method',
  'model', 'equal_variance', 'group1_normality', 'group2_normality']);
const fmtStatVal = (v) => {
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'number') {
    if (v !== 0 && Math.abs(v) < 1e-4) return v.toExponential(3);
    return Number.isInteger(v) ? String(v) : String(parseFloat(v.toPrecision(6)));
  }
  return String(v);
};
function normalizeStatResult(r) {
  if (!r || typeof r !== 'object' || r.summary || r.interpretation) return r;
  const summary = {};
  const addGroup = (key, label) => {
    const g = r[key];
    if (g && typeof g === 'object') {
      summary[`${label} n`] = fmtStatVal(g.n);
      summary[`${label} 均值`] = fmtStatVal(g.mean);
      summary[`${label} 标准差`] = fmtStatVal(g.std);
      if (g.ci95_lower !== undefined) summary[`${label} 95%CI`] = `[${fmtStatVal(g.ci95_lower)}, ${fmtStatVal(g.ci95_upper)}]`;
    }
  };
  ['group1_stats', 'group2_stats', 'group3_stats', 'group4_stats'].forEach((k, i) =>
    addGroup(k, `组${i + 1}`));
  for (const [k, v] of Object.entries(r)) {
    if (v === null || v === undefined || STAT_SKIP.has(k)) continue;
    if (/^group\d+_/.test(k)) continue;
    if (k === 'comparisons' || k === 'posthoc' || k === 'pairs') continue;
    const label = STAT_LABELS[k] || k;
    if (typeof v === 'object') {
      if (Array.isArray(v)) {
        if (v.length && typeof v[0] === 'object') continue;
        summary[label] = v.map(fmtStatVal).join(', ');
      } else if (/normality/.test(k)) {
        summary[k] = `${v.conclusion || ''} (p=${v.p_value_fmt ?? fmtStatVal(v.p_value)})`;
      } else {
        summary[label] = JSON.stringify(v).slice(0, 80);
      }
    } else {
      summary[label] = fmtStatVal(v);
    }
  }
  const comparisons = Array.isArray(r.comparisons) ? r.comparisons : undefined;
  return {
    method: r.test_name || r.method,
    interpretation: r.conclusion || r.interpretation,
    summary,
    comparisons,
  };
}

export default function Statistics({ currentProject }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [method, setMethod] = useState('ttest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [datasetSource, setDatasetSource] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [saveState, setSaveState] = useState(null);
  const [savedAnalysisId, setSavedAnalysisId] = useState(null);

  // GraphPad 式整合:?dataset=<id> 时自动从数据集载入分组数据 —— zcode
  useEffect(() => {
    const dsId = searchParams.get('dataset');
    if (!dsId) return;
    setDatasetId(Number(dsId));
    loadDataset(null, dsId)
      .then((ds) => {
        if (!ds) return;
        const pre = ttestFromDataset(ds);
        if (pre) {
          setTtestG1(pre.g1.join(', '));
          setTtestG2(pre.g2.join(', '));
          setDatasetSource(`${ds.name}(组1=${pre.names[0]}, 组2=${pre.names[1]})`);
          // 三组及以上时自动给 ANOVA 预填分组
          if (pre.groups && Object.keys(pre.groups).length >= 3) {
            setAnovaGroups(Object.entries(pre.groups)
              .map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n'));
            setMethod('anova');
          }
        } else {
          setDatasetSource(`${ds.name}(未识别出可分析的分组结构)`);
        }
      })
      .catch(() => setDatasetSource('数据集载入失败'));
  }, [searchParams]);

  // t 检验参数
  const [ttestType, setTtestType] = useState('two_sample');
  const [ttestG1, setTtestG1] = useState('12.4, 14.2, 11.8, 13.5, 12.9, 14.0, 13.2');
  const [ttestG2, setTtestG2] = useState('18.2, 19.5, 17.9, 20.1, 18.8, 19.2, 18.5');
  const [alpha, setAlpha] = useState(0.05);

  // ANOVA 参数
  const [anovaType, setAnovaType] = useState('one_way');
  const [anovaGroups, setAnovaGroups] = useState(
    '对照组: 12.4, 14.1, 11.8, 13.5, 12.9\n低剂量: 18.2, 19.5, 17.9, 20.1, 18.8\n中剂量: 28.5, 30.1, 29.2, 31.4, 27.9\n高剂量: 45.1, 43.8, 46.5, 44.2, 47.0'
  );

  // 回归参数
  const [regX, setRegX] = useState('1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0');
  const [regY, setRegY] = useState('2.1, 3.9, 6.2, 8.1, 10.2, 12.0, 13.9, 16.1');
  const [regType, setRegType] = useState('linear');

  // IC50 参数
  const [ic50Conc, setIc50Conc] = useState('0.001, 0.01, 0.1, 1.0, 10.0, 100.0, 1000.0');
  const [ic50Resp, setIc50Resp] = useState('98.5, 92.3, 78.2, 52.4, 23.1, 8.9, 2.1');

  // 生存分析参数
  const [survDurations, setSurvDurations] = useState('4.5, 6.0, 8.2, 11.5, 14.0, 18.3, 22.1, 26.4');
  const [survEvents, setSurvEvents] = useState('1, 1, 0, 1, 0, 1, 0, 0');
  const [survGroups, setSurvGroups] = useState('A, B, A, B, A, B, A, A');

  // ROC 参数
  const [rocTrue, setRocTrue] = useState('0, 0, 0, 0, 1, 0, 1, 1, 1, 1');
  const [rocScore, setRocScore] = useState('0.1, 0.2, 0.35, 0.4, 0.55, 0.6, 0.75, 0.8, 0.88, 0.95');

  // 辅助解析逗号或空格分隔数字数组
  const parseNumArray = (str) => {
    return str
      .split(/[\s,]+/)
      .map(v => v.trim())
      .filter(v => v !== '')
      .map(Number)
      .filter(v => !isNaN(v));
  };

  // 运行统计分析
  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      let res = null;

      if (method === 'ttest') {
        const g1 = parseNumArray(ttestG1);
        const g2 = parseNumArray(ttestG2);
        if (g1.length === 0 || (ttestType !== 'one_sample' && g2.length === 0)) {
          throw new Error('请输入有效的样本数值');
        }
        res = await statsApi.ttest({
          type: ttestType,
          group1: g1,
          group2: g2,
          alpha: Number(alpha),
        });
      } else if (method === 'anova') {
        const lines = anovaGroups.trim().split('\n').filter(l => l.trim() !== '');
        const group_names = [];
        const groups = [];
        lines.forEach((line, idx) => {
          const parts = line.split(':');
          if (parts.length > 1) {
            group_names.push(parts[0].trim());
            groups.push(parseNumArray(parts[1]));
          } else {
            group_names.push(`组 ${idx + 1}`);
            groups.push(parseNumArray(parts[0]));
          }
        });
        res = await statsApi.anova({
          type: anovaType,
          groups: groups,
          group_names: group_names,
          alpha: Number(alpha),
        });
      } else if (method === 'nonparam') {
        const g1 = parseNumArray(ttestG1);
        const g2 = parseNumArray(ttestG2);
        res = await statsApi.nonparam({
          type: 'mann_whitney',
          group1: g1,
          group2: g2,
          alpha: Number(alpha),
        });
      } else if (method === 'regression') {
        const x = parseNumArray(regX);
        const y = parseNumArray(regY);
        if (x.length !== y.length) throw new Error('X 和 Y 的数据点数量必须相同');
        res = await statsApi.regression({
          type: regType,
          x: x,
          y: y,
        });
      } else if (method === 'ic50') {
        const x = parseNumArray(ic50Conc);
        const y = parseNumArray(ic50Resp);
        if (x.length !== y.length) throw new Error('浓度和响应值数据点数量必须相同');
        res = await statsApi.ic50({
          x: x,
          y: y,
          model: '4pl',
        });
      } else if (method === 'survival') {
        const duration = parseNumArray(survDurations);
        const event = parseNumArray(survEvents);
        const groups = survGroups.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
        res = await statsApi.survival({
          type: 'kaplan_meier',
          duration: duration,
          event: event,
          groups: groups.length === duration.length ? groups : undefined,
        });
      } else if (method === 'roc') {
        const y_true = parseNumArray(rocTrue);
        const y_score = parseNumArray(rocScore);
        res = await statsApi.roc({
          y_true: y_true,
          y_score: y_score,
        });
      }

      if (res && res.error) {
        throw new Error(res.error);
      }
      setResults(normalizeStatResult(res.result || res));
    } catch (err) {
      setError(err.message || '统计分析计算失败');
      // 已移除伪造统计数据的本地兜底：失败时只展示错误提示 (zcode)
    } finally {
      setLoading(false);
    }
  };

  // 本地离线兜底计算模拟，保障前端体验
  const generateLocalFallback = (m) => {
    if (m === 'ttest') {
      setResults({
        method: '独立双样本 t 检验 (Welch t-test)',
        interpretation: '两组样本均值具有极显著统计学差异 (p < 0.001)，表明给药组与对照组反应强度显著不同。',
        summary: {
          '检验统计量 t': '-7.625',
          '自由度 df': '11.8',
          'p 值': '0.000007',
          '显著性结论': '极其显著 (***, p < 0.001)',
          '95% 置信区间': '[-6.92, -3.94]',
          '效应量 Cohen\'s d': '4.07 (极强效应)',
        },
        comparisons: [
          { group: '组 1 vs 组 2', statistic: -7.625, p_value: 0.000007, effect_size: 4.07 }
        ]
      });
    } else if (m === 'anova') {
      setResults({
        method: '单因素方差分析 (One-way ANOVA)',
        interpretation: '组间方差显著大于组内方差 (F = 184.2, p < 0.0001)，不同药物浓度处理存在高度显著差异。',
        summary: {
          'F 统计量': '184.21',
          'p 值': '1.24e-13',
          '显著性': '极其显著 (***)',
          '效应量 η² (Eta-squared)': '0.972',
        },
        comparisons: [
          { group: '对照组 vs 低剂量', statistic: 6.4, p_value: 0.0002, effect_size: 1.8 },
          { group: '对照组 vs 中剂量', statistic: 16.5, p_value: 0.00001, effect_size: 4.2 },
          { group: '对照组 vs 高剂量', statistic: 32.1, p_value: 0.000001, effect_size: 8.5 },
        ]
      });
    }
  };

  // 保存分析结果到数据集(Prism 式结果工作表)—— zcode
  const handleSaveAnalysis = async () => {
    if (!results) return;
    try {
      const projectId = Number(searchParams.get('project')) || currentProject?.id || null;
      const res = await analysesApi.save({
        analysis_type: method,
        params: { ttestType, alpha, g1: ttestG1, g2: ttestG2, dataset_source: datasetSource },
        result: results,
        dataset_id: datasetId,
        project_id: projectId,
      });
      setSavedAnalysisId(res.data?.id || null);
      setSaveState('已保存到数据集 ✓');
      setTimeout(() => setSaveState(null), 3000);
    } catch (e) {
      setSaveState(`保存失败:${e.message}`);
    }
  };

  // 生成关联图表:带着刚保存的 analysis_id 进入图表页,保存图表时自动挂钩 —— zcode
  const gotoLinkedChart = () => {
    if (!datasetId) return;
    const pid = searchParams.get('project') || currentProject?.id || '';
    navigate(`/charts?dataset=${datasetId}&project=${pid}${savedAnalysisId ? `&analysis=${savedAnalysisId}` : ''}`);
  };

  // 导出本次结果 JSON(可复现)—— zcode
  const exportResultJson = () => {
    if (!results) return;
    const payload = {
      _export: 'labvault-result@v1',
      analysis_type: method,
      params: { ttestType, alpha, g1: ttestG1, g2: ttestG2, dataset_source: datasetSource },
      result: results,
      dataset_id: datasetId,
      saved_analysis_id: savedAnalysisId,
      generated_at: new Date().toLocaleString('sv'),
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `labvault-result-${method}-${Date.now()}.json`);
  };

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部标题栏 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>统计分析中心 (Statistical Analysis)</Typography>
          <Typography variant="body2" color="text.secondary">
            对标 GraphPad Prism 全套生物医学与科研统计检验算法
          </Typography>
          {datasetSource && (
            <Chip size="small" color="primary" variant="outlined"
              icon={<ScienceIcon fontSize="small" />}
              label={`数据来源:${datasetSource}`}
              sx={{ mt: 1 }} onDelete={() => setDatasetSource(null)} />
          )}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {saveState && (
            <Typography variant="caption" color={saveState.includes('失败') ? 'error' : 'success.main'}>
              {saveState}
            </Typography>
          )}
          <Button
            variant="outlined"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={handleSaveAnalysis}
            disabled={!results || !datasetId}
            size="small"
          >
            保存到数据集
          </Button>
          {savedAnalysisId && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<BarChartIcon />}
              onClick={gotoLinkedChart}
              size="small"
            >
              生成关联图表
            </Button>
          )}
          {results && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={exportResultJson}
              size="small"
            >
              导出结果 JSON
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<BarChartIcon />}
            onClick={() => navigate('/charts')}
            size="small"
          >
            转至图表绘制
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={handleRunAnalysis}
            disabled={loading}
            size="small"
          >
            {loading ? '正在计算…' : '执行统计分析'}
          </Button>
        </Stack>
      </Box>

      {/* 主界面网格 */}
      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* 左侧：方法与参数输入 */}
        <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {/* 方法选择 */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase' }}>
              1. 选择统计方法
            </Typography>
            <Stack spacing={1}>
              {METHODS.map((m) => (
                <Box
                  key={m.id}
                  onClick={() => { setMethod(m.id); setResults(null); }}
                  sx={{
                    p: 1.2,
                    border: '1px solid',
                    borderColor: method === m.id ? 'primary.main' : 'divider',
                    borderRadius: 1.5,
                    bgcolor: method === m.id ? 'primary.light' + '12' : 'background.paper',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={method === m.id ? 700 : 600} color={method === m.id ? 'primary.main' : 'text.primary'}>
                    {m.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {m.desc}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* 参数配置 */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase' }}>
              2. 检验参数与输入数据
            </Typography>

            {/* t 检验表单 */}
            {method === 'ttest' && (
              <Stack spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>t 检验类型</InputLabel>
                  <Select value={ttestType} label="t 检验类型" onChange={(e) => setTtestType(e.target.value)}>
                    <MenuItem value="two_sample">独立双样本 (Two-sample t-test)</MenuItem>
                    <MenuItem value="paired">配对样本 (Paired t-test)</MenuItem>
                    <MenuItem value="one_sample">单样本对比理论值 (One-sample)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="样本组 1 数据 (逗号/空格分隔)"
                  multiline
                  rows={2}
                  size="small"
                  value={ttestG1}
                  onChange={(e) => setTtestG1(e.target.value)}
                  fullWidth
                />
                {ttestType !== 'one_sample' && (
                  <TextField
                    label="样本组 2 数据 (逗号/空格分隔)"
                    multiline
                    rows={2}
                    size="small"
                    value={ttestG2}
                    onChange={(e) => setTtestG2(e.target.value)}
                    fullWidth
                  />
                )}
              </Stack>
            )}

            {/* ANOVA 表单 */}
            {method === 'anova' && (
              <Stack spacing={2}>
                <Typography variant="caption" color="text.secondary">
                  每行代表一组，格式为「组名: 数值1, 数值2...」
                </Typography>
                <TextField
                  label="各组样本数据"
                  multiline
                  rows={5}
                  size="small"
                  value={anovaGroups}
                  onChange={(e) => setAnovaGroups(e.target.value)}
                  fullWidth
                />
              </Stack>
            )}

            {/* 回归表单 */}
            {method === 'regression' && (
              <Stack spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>回归模型</InputLabel>
                  <Select value={regType} label="回归模型" onChange={(e) => setRegType(e.target.value)}>
                    <MenuItem value="linear">简单线性回归 (Linear)</MenuItem>
                    <MenuItem value="polynomial">多项式回归 (Polynomial)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="自变量 X 数据序列"
                  multiline
                  rows={2}
                  size="small"
                  value={regX}
                  onChange={(e) => setRegX(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="因变量 Y 数据序列"
                  multiline
                  rows={2}
                  size="small"
                  value={regY}
                  onChange={(e) => setRegY(e.target.value)}
                  fullWidth
                />
              </Stack>
            )}

            {/* IC50 表单 */}
            {method === 'ic50' && (
              <Stack spacing={2}>
                <TextField
                  label="药物浓度 Concentration (nM/µM)"
                  multiline
                  rows={2}
                  size="small"
                  value={ic50Conc}
                  onChange={(e) => setIc50Conc(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="细胞活性/抑制率 Response (%)"
                  multiline
                  rows={2}
                  size="small"
                  value={ic50Resp}
                  onChange={(e) => setIc50Resp(e.target.value)}
                  fullWidth
                />
              </Stack>
            )}

            {/* 生存分析表单 */}
            {method === 'survival' && (
              <Stack spacing={2}>
                <TextField
                  label="随访生存时间 Duration"
                  size="small"
                  value={survDurations}
                  onChange={(e) => setSurvDurations(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="事件状态 Event (1=死亡/复发, 0=删失)"
                  size="small"
                  value={survEvents}
                  onChange={(e) => setSurvEvents(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="分组标识 Groups (例: A, B, A, B...)"
                  size="small"
                  value={survGroups}
                  onChange={(e) => setSurvGroups(e.target.value)}
                  fullWidth
                />
              </Stack>
            )}

            {/* ROC 表单 */}
            {method === 'roc' && (
              <Stack spacing={2}>
                <TextField
                  label="真实类别 Label (0或1)"
                  size="small"
                  value={rocTrue}
                  onChange={(e) => setRocTrue(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="预测得分 / 标志物浓度 Score"
                  size="small"
                  value={rocScore}
                  onChange={(e) => setRocScore(e.target.value)}
                  fullWidth
                />
              </Stack>
            )}

            {/* 显著性水平设置 */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">显著性水准 (α-level)</Typography>
              <RadioGroup row value={alpha} onChange={(e) => setAlpha(Number(e.target.value))}>
                <FormControlLabel value={0.05} control={<Radio size="small" />} label="α = 0.05" />
                <FormControlLabel value={0.01} control={<Radio size="small" />} label="α = 0.01" />
                <FormControlLabel value={0.001} control={<Radio size="small" />} label="α = 0.001" />
              </RadioGroup>
            </Box>
          </Paper>
        </Grid>

        {/* 右侧：统计分析报告输出 */}
        <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              borderRadius: 2,
              overflowY: 'auto'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                统计检验结果报告
              </Typography>
              {results && (
                <Chip
                  icon={<CheckCircleOutlineIcon />}
                  label="计算完成"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <StatResults
              results={results}
              method={METHODS.find(m => m.id === method)?.label}
              loading={loading}
              error={error}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
