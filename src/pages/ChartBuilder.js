import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Select,
  MenuItem, FormControl, InputLabel, Tabs, Tab, Stack, Chip,
  Divider, Card, CardContent, Switch, FormControlLabel,
  Alert, CircularProgress, IconButton, Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import TimelineIcon from '@mui/icons-material/Timeline';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PieChartIcon from '@mui/icons-material/PieChart';
import { chartsApi, datasetsApi, projectsApi, exportApi, downloadBlob } from '../utils/api';
import { useSearchParams } from 'react-router-dom';
import { chartParamsFromDataset, loadDataset } from '../utils/datasetStats';
import ChartViewer from '../components/ChartViewer';

const CHART_TYPES = [
  { id: 'line', label: '折线图 (Line)', icon: <ShowChartIcon fontSize="small" />, desc: '适用于时间序列、动力学' },
  { id: 'bar', label: '柱状图 (Bar)', icon: <BarChartIcon fontSize="small" />, desc: '组间均值比较' },
  { id: 'scatter', label: '散点图 (Scatter)', icon: <ScatterPlotIcon fontSize="small" />, desc: '变量相关性分析' },
  { id: 'box', label: '箱线图 (Box)', icon: <AnalyticsIcon fontSize="small" />, desc: '数据分布与四分位' },
  { id: 'violin', label: '小提琴图 (Violin)', icon: <AnalyticsIcon fontSize="small" />, desc: '核密度估计与分布' },
  { id: 'error_bar', label: '误差棒图 (Mean ± SD)', icon: <BarChartIcon fontSize="small" />, desc: '均值与标准误/差' },
  { id: 'ic50', label: 'IC50/EC50 拟合', icon: <TimelineIcon fontSize="small" />, desc: 'Sigmoidal 剂量-效应' },
  { id: 'survival', label: 'Kaplan-Meier 生存', icon: <TimelineIcon fontSize="small" />, desc: '生存时间与终点事件' },
  { id: 'roc', label: 'ROC 曲线', icon: <ShowChartIcon fontSize="small" />, desc: '诊断性能与 AUC' },
  { id: 'histogram', label: '直方图 (Histogram)', icon: <BarChartIcon fontSize="small" />, desc: '频数分布' },
];

export default function ChartBuilder({ currentProject }) {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('project') || currentProject?.id || '');
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(searchParams.get('dataset') || '');
  const [currentDataset, setCurrentDataset] = useState(null);
  const [autoTried, setAutoTried] = useState(false);

  // 图表配置
  const [chartType, setChartType] = useState('bar');
  const [title, setTitle] = useState('实验组与对照组比较');
  const [xLabel, setXLabel] = useState('分组 (Group)');
  const [yLabel, setYLabel] = useState('反应测量值 (Unit)');
  const [barmode, setBarmode] = useState('group'); // group, stack
  const [orientation, setOrientation] = useState('v'); // v, h

  // 图表渲染状态
  const [plotData, setPlotData] = useState([]);
  const [plotLayout, setPlotLayout] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSourceLabel, setDataSourceLabel] = useState('演示数据');

  // 初始化加载项目
  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data || res.projects || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => {});
  }, [selectedProjectId]);

  // 加载数据集列表
  useEffect(() => {
    if (!selectedProjectId) return;
    datasetsApi.list(selectedProjectId)
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data || res.datasets || [];
        setDatasets(list);
        if (list.length > 0) {
          setSelectedDatasetId(list[0].id);
        }
      })
      .catch(() => {});
  }, [selectedProjectId]);

  // 加载具体数据集内容
  useEffect(() => {
    if (!selectedProjectId || !selectedDatasetId) return;
    datasetsApi.get(selectedProjectId, selectedDatasetId)
      .then((res) => {
        const ds = res.data || res.dataset || res;
        setCurrentDataset(ds);
      })
      .catch(() => {});
  }, [selectedProjectId, selectedDatasetId]);

  // 构建默认示例数据生成图表请求
  const buildParams = () => {
    const baseParams = {
      chart_type: chartType,
      title: title,
      x_label: xLabel,
      y_label: yLabel,
    };

    if (chartType === 'line') {
      return {
        ...baseParams,
        series: [
          { name: '对照组 (Control)', x: [0, 2, 4, 6, 8, 10], y: [100, 98, 95, 93, 91, 89], error_y: [2, 2.5, 3, 2.8, 3.2, 3.5] },
          { name: '实验组 (Drug A)', x: [0, 2, 4, 6, 8, 10], y: [100, 85, 62, 45, 30, 18], error_y: [3, 4, 3.5, 2.9, 2.5, 2.0] },
          { name: '联合组 (Drug A+B)', x: [0, 2, 4, 6, 8, 10], y: [100, 72, 43, 22, 11, 5], error_y: [2.5, 3.2, 2.8, 2.0, 1.5, 1.2] }
        ]
      };
    } else if (chartType === 'bar') {
      return {
        ...baseParams,
        barmode: barmode,
        series: [
          { name: '对照组 (Control)', x: ['24h', '48h', '72h'], y: [15.2, 28.4, 45.1], error_y: [1.2, 2.1, 3.0] },
          { name: '给药组 (Treatment)', x: ['24h', '48h', '72h'], y: [32.6, 64.8, 92.3], error_y: [2.5, 4.3, 5.1] }
        ]
      };
    } else if (chartType === 'scatter') {
      return {
        ...baseParams,
        series: [
          { name: '野生型 (WT)', x: [1.2, 2.5, 3.1, 4.8, 5.5, 6.2, 7.9], y: [10, 22, 33, 45, 58, 65, 80], trendline: true },
          { name: '突变型 (Mutant)', x: [1.5, 2.8, 3.5, 4.2, 5.9, 6.8, 8.1], y: [5, 12, 18, 25, 32, 40, 51], trendline: true }
        ]
      };
    } else if (chartType === 'box') {
      return {
        ...baseParams,
        groups: [
          { name: '空白对照', values: [12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25] },
          { name: '低剂量 (1mg)', values: [22, 25, 26, 28, 29, 31, 32, 34, 35, 38] },
          { name: '中剂量 (5mg)', values: [42, 45, 48, 50, 52, 53, 55, 57, 60] },
          { name: '高剂量 (20mg)', values: [65, 70, 72, 75, 78, 80, 82, 85, 90] }
        ]
      };
    } else if (chartType === 'violin') {
      return {
        ...baseParams,
        groups: [
          { name: 'Placebo', values: [10, 12, 13, 14, 15, 16, 17, 18, 19, 21, 24] },
          { name: 'Compound X', values: [25, 30, 32, 35, 36, 38, 40, 42, 45, 48, 52] }
        ]
      };
    } else if (chartType === 'error_bar') {
      return {
        ...baseParams,
        categories: ['基线', '第1周', '第2周', '第4周', '第8周'],
        series: [
          { name: '安慰剂组', means: [100, 98, 96, 94, 92], errors: [4, 5, 4.5, 5.2, 6.0] },
          { name: '药物治疗组', means: [100, 82, 65, 48, 32], errors: [4, 3.8, 3.2, 2.9, 2.1] }
        ]
      };
    } else if (chartType === 'ic50') {
      return {
        ...baseParams,
        title: title || '剂量-反应曲线 (IC50 拟合)',
        x_label: '对数浓度 log[Inhibitor] (M)',
        y_label: '抑制率 Response (%)',
        log_conc: [-9, -8, -7, -6.5, -6, -5.5, -5, -4],
        response: [98.2, 95.1, 88.4, 72.0, 50.3, 28.5, 12.1, 4.2],
        ic50_value: 1.05e-6,
        r2: 0.994
      };
    } else if (chartType === 'survival') {
      return {
        ...baseParams,
        title: title || 'Kaplan-Meier 生存曲线',
        x_label: '时间 (月)',
        y_label: '累积生存率',
        groups: [
          {
            name: '标准化疗',
            times: [0, 3, 6, 9, 12, 15, 18, 24],
            survival_prob: [1.0, 0.90, 0.75, 0.60, 0.45, 0.35, 0.25, 0.15],
            censored_times: [6, 15]
          },
          {
            name: '新靶向联合化疗',
            times: [0, 3, 6, 9, 12, 15, 18, 24],
            survival_prob: [1.0, 0.95, 0.88, 0.80, 0.72, 0.65, 0.58, 0.50],
            censored_times: [9, 18, 24]
          }
        ]
      };
    } else if (chartType === 'roc') {
      return {
        ...baseParams,
        title: title || '受试者工作特征 (ROC) 曲线',
        x_label: '1 - 特异度 (假阳性率)',
        y_label: '敏感度 (真阳性率)',
        fpr: [0.0, 0.05, 0.10, 0.15, 0.25, 0.40, 0.60, 1.0],
        tpr: [0.0, 0.45, 0.68, 0.82, 0.91, 0.95, 0.98, 1.0],
        auc: 0.892
      };
    } else if (chartType === 'histogram') {
      return {
        ...baseParams,
        values: [12, 15, 18, 19, 21, 22, 23, 24, 25, 25, 26, 27, 28, 29, 30, 32, 35, 38, 41, 45],
        nbins: 10
      };
    }

    return baseParams;
  };

  // 刷新生成图表
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // GraphPad 式整合:优先用当前数据集的真实数据构建参数 —— zcode
      const realParams = currentDataset
        ? chartParamsFromDataset(currentDataset, chartType, { title, xLabel, yLabel, barmode })
        : null;
      setDataSourceLabel(realParams ? `数据集:${currentDataset.name}` : '演示数据');
      const params = realParams || buildParams();
      const res = await chartsApi.generate(params);
      if (res.error) {
        throw new Error(res.error);
      }
      const pJson = res.plotly_json || res;
      setPlotData(pJson.data || []);
      setPlotLayout(pJson.layout || {});
    } catch (err) {
      setError(err.message || '生成图表失败');
      // 容错兜底：若后端未启动或报错，前端本地呈现高质量图表
      renderFallbackChart();
    } finally {
      setLoading(false);
    }
  };

  // 数据集就绪后自动生成一次(带 ?dataset= 进入时)—— zcode
  useEffect(() => {
    if (currentDataset && !autoTried) {
      setAutoTried(true);
      handleGenerate();
    }
  }, [currentDataset]);

  // 本地兜底渲染（确保离线或服务等待时界面同样可用）
  const renderFallbackChart = () => {
    if (chartType === 'bar') {
      setPlotData([
        { x: ['对照组', '低剂量', '中剂量', '高剂量'], y: [15.2, 28.4, 45.1, 78.5], type: 'bar', name: '反应强度', marker: { color: '#1565C0' } }
      ]);
      setPlotLayout({ title: title || '柱状图分析', xaxis: { title: xLabel }, yaxis: { title: yLabel } });
    } else if (chartType === 'line') {
      setPlotData([
        { x: [0, 2, 4, 6, 8, 10], y: [100, 85, 62, 45, 30, 18], type: 'scatter', mode: 'lines+markers', name: '实验组', marker: { color: '#00897B' } },
        { x: [0, 2, 4, 6, 8, 10], y: [100, 98, 95, 93, 91, 89], type: 'scatter', mode: 'lines+markers', name: '对照组', marker: { color: '#E65100' } }
      ]);
      setPlotLayout({ title: title || '时间序列曲线', xaxis: { title: xLabel }, yaxis: { title: yLabel } });
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [chartType]);

  // 导出 SVG 图表
  const handleExportSvg = async () => {
    try {
      const res = await exportApi.svg({
        chart_data: { data: plotData, layout: plotLayout },
        title: title || 'Chart',
      });
      downloadBlob(res.data, `${title || 'chart'}.svg`);
    } catch (err) {
      alert('导出 SVG 失败: ' + err.message);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部标题栏 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>图表构建器 (Graph Builder)</Typography>
          <Typography variant="body2" color="text.secondary">
            针对科研出版规范设计，生成可发表级高质量学术图表
          </Typography>
          <Chip size="small"
            color={dataSourceLabel.startsWith('数据集') ? 'primary' : 'default'}
            variant="outlined"
            label={dataSourceLabel}
            sx={{ mt: 1 }} />
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportSvg}
            disabled={plotData.length === 0}
            size="small"
          >
            导出矢量图 (SVG)
          </Button>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleGenerate}
            size="small"
          >
            更新图表
          </Button>
        </Stack>
      </Box>

      {/* 主界面网格 */}
      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* 左侧配置面板 */}
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {/* 图表类型选择 */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase' }}>
              1. 选择图表类型
            </Typography>
            <Grid container spacing={1}>
              {CHART_TYPES.map((t) => (
                <Grid item xs={6} key={t.id}>
                  <Box
                    onClick={() => setChartType(t.id)}
                    sx={{
                      p: 1.2,
                      border: '1px solid',
                      borderColor: chartType === t.id ? 'primary.main' : 'divider',
                      borderRadius: 1.5,
                      bgcolor: chartType === t.id ? 'primary.light' + '15' : 'background.paper',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.light' + '0A' },
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ color: chartType === t.id ? 'primary.main' : 'text.secondary' }}>
                        {t.icon}
                      </Box>
                      <Typography variant="caption" fontWeight={chartType === t.id ? 700 : 500} noWrap>
                        {t.label.split(' ')[0]}
                      </Typography>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* 数据与轴标配置 */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase' }}>
              2. 样式与轴标签
            </Typography>
            <Stack spacing={2}>
              <TextField
                size="small"
                label="图表主标题 (Title)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="X 轴标题 (X Axis)"
                value={xLabel}
                onChange={(e) => setXLabel(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="Y 轴标题 (Y Axis)"
                value={yLabel}
                onChange={(e) => setYLabel(e.target.value)}
                fullWidth
              />

              {chartType === 'bar' && (
                <FormControl size="small" fullWidth>
                  <InputLabel>柱状模式</InputLabel>
                  <Select
                    value={barmode}
                    label="柱状模式"
                    onChange={(e) => setBarmode(e.target.value)}
                  >
                    <MenuItem value="group">并列分组 (Grouped)</MenuItem>
                    <MenuItem value="stack">堆叠显示 (Stacked)</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* 右侧交互预览面板 */}
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              position: 'relative',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                交互式预览 (Plotly Engine)
              </Typography>
              <Chip label={CHART_TYPES.find(c => c.id === chartType)?.label} size="small" color="primary" variant="outlined" />
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ flex: 1, minHeight: 450, position: 'relative' }}>
              <ChartViewer
                data={plotData}
                layout={plotLayout}
                title=""
                loading={loading}
                error={error}
                height={480}
                onRefresh={handleGenerate}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
