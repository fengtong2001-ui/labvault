import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, TextField, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Chip, Alert,
  Snackbar, Stack, Menu, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import BarChartIcon from '@mui/icons-material/BarChart';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import CalculateIcon from '@mui/icons-material/Calculate';
import ScienceIcon from '@mui/icons-material/Science';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { datasetsApi, projectsApi, importApi, analysesApi, chartsApi, downloadBlob } from '../utils/api';
import { mean, sd, classifyColumns, groupValues } from '../utils/datasetStats';
import ChartViewer from '../components/ChartViewer';
import DataImport from '../components/DataImport';

// 预设科研模板数据集
const SAMPLE_TEMPLATES = [
  {
    name: '药物抑制率曲线 (IC50)',
    columns: ['Concentration (nM)', 'Rep 1', 'Rep 2', 'Rep 3'],
    data: [
      ['0.1', '98.5', '99.1', '97.8'],
      ['1.0', '92.3', '94.0', '91.7'],
      ['5.0', '78.2', '80.1', '76.9'],
      ['10.0', '52.4', '54.1', '50.8'],
      ['50.0', '23.1', '25.0', '22.4'],
      ['100.0', '8.9', '10.2', '9.1'],
      ['500.0', '2.1', '1.8', '2.5'],
    ]
  },
  {
    name: '两组降压药物对比 (t检验)',
    columns: ['Subject ID', 'Control (mmHg)', 'Treatment (mmHg)'],
    data: [
      ['1', '135.2', '122.4'],
      ['2', '140.1', '125.0'],
      ['3', '138.5', '120.8'],
      ['4', '142.0', '126.5'],
      ['5', '136.8', '119.2'],
      ['6', '139.4', '123.7'],
      ['7', '145.1', '128.0'],
      ['8', '137.9', '121.5'],
    ]
  },
  {
    name: '多组浓度药物反应 (ANOVA)',
    columns: ['Vehicle', 'Low Dose (1mg)', 'Medium Dose (5mg)', 'High Dose (20mg)'],
    data: [
      ['12.4', '18.2', '28.5', '45.1'],
      ['14.1', '19.5', '30.1', '43.8'],
      ['11.8', '17.9', '29.2', '46.5'],
      ['13.5', '20.1', '31.4', '44.2'],
      ['12.9', '18.8', '27.9', '47.0'],
    ]
  },
  {
    name: '癌症患者生存分析 (Kaplan-Meier)',
    columns: ['Time (months)', 'Status (1=dead, 0=censored)', 'Treatment Group'],
    data: [
      ['4.5', '1', 'Chemo + Drug'],
      ['6.0', '1', 'Chemo Only'],
      ['8.2', '0', 'Chemo + Drug'],
      ['11.5', '1', 'Chemo Only'],
      ['14.0', '0', 'Chemo + Drug'],
      ['18.3', '1', 'Chemo Only'],
      ['22.1', '0', 'Chemo + Drug'],
      ['26.4', '0', 'Chemo + Drug'],
    ]
  }
];

export default function DataTable({ currentProject }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [searchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('project') || currentProject?.id || '');
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(searchParams.get('dataset') || '');
  
  // 表格状态
  const [columns, setColumns] = useState(['Column A', 'Column B', 'Column C']);
  const [rows, setRows] = useState([
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ]);
  const [datasetName, setDatasetName] = useState('未命名数据集');
  const [editingDatasetId, setEditingDatasetId] = useState(null);

  // 未保存改动跟踪:与最近一次 保存/载入 的快照比对 —— zcode
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const snapshotOf = (name, cols, rws) => JSON.stringify([name, cols, rws]);

  // 快速统计:点列头统计图标 —— 数值列出单列统计,分类列自动联动按组统计 —— zcode
  const [quickStatCol, setQuickStatCol] = useState(null);
  const quickStat = useMemo(() => {
    const idx = quickStatCol;
    if (idx === null || idx === undefined || idx >= columns.length) return null;
    const raw = rows.map(r => Array.isArray(r) ? r[idx] : '')
      .filter(v => v !== '' && v !== null && v !== undefined);
    const nums = raw.map(Number).filter(v => !isNaN(v));
    // 数值列:单列统计
    if (raw.length > 0 && nums.length / raw.length >= 0.8) {
      return { kind: 'numeric', col: columns[idx], n: nums.length,
               mean: mean(nums), sd: sd(nums),
               min: Math.min(...nums), max: Math.max(...nums) };
    }
    // 分类列:联动第一个数值列,按组统计
    const { categorical, numeric } = classifyColumns(columns, rows);
    if (categorical.includes(idx) && numeric.length) {
      const groups = groupValues(rows, idx, numeric[0]);
      const details = Object.keys(groups).map(n => ({
        name: n, n: groups[n].length, mean: mean(groups[n]), sd: sd(groups[n]),
      }));
      return { kind: 'categorical', col: columns[idx], valCol: columns[numeric[0]], details };
    }
    return { kind: 'empty', col: columns[idx] };
  }, [quickStatCol, rows, columns]);

  // 分组均值(分类列→数值列):Prism 式组间对比入口 —— zcode
  const groupCompare = useMemo(() => {
    const { categorical, numeric } = classifyColumns(columns, rows);
    if (!categorical.length || !numeric.length) return null;
    const groups = groupValues(rows, categorical[0], numeric[0]);
    const names = Object.keys(groups);
    if (names.length < 2) return null;
    return {
      catCol: columns[categorical[0]],
      valCol: columns[numeric[0]],
      means: names.map(n => `${n}=${mean(groups[n]).toFixed(3)}`),
      details: names.map(n => ({ name: n, n: groups[n].length,
        mean: mean(groups[n]), sd: sd(groups[n]) })),
    };
  }, [columns, rows]);

  const isDirty = useMemo(() => {
    if (savedSnapshot === null) return false;
    return JSON.stringify([datasetName, columns, rows]) !== savedSnapshot;
  }, [datasetName, columns, rows, savedSnapshot]);
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 工作簿:当前数据集已保存的分析结果与图表(Prism 式 Results/Graphs)—— zcode
  const [workbook, setWorkbook] = useState({ analyses: [], charts: [] });
  const [wbOpen, setWbOpen] = useState(true);
  const [viewChart, setViewChart] = useState(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState(null);
  const refreshWorkbook = useCallback((dsId) => {
    if (!dsId) {
      setWorkbook({ analyses: [], charts: [] });
      return;
    }
    analysesApi.list({ dataset_id: dsId })
      .then((res) => setWorkbook((w) => ({ ...w, analyses: res.data || [] })))
      .catch(() => {});
    chartsApi.list({ dataset_id: dsId })
      .then((res) => setWorkbook((w) => ({ ...w, charts: res.data || [] })))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshWorkbook(selectedDatasetId);
  }, [selectedDatasetId, editingDatasetId, refreshWorkbook]);

  // 工作簿条目删除/重新生成 —— zcode
  const handleDeleteChart = async (e, c) => {
    e.stopPropagation();
    if (!window.confirm(`删除图表「${c.title || c.chart_type}」?此操作不可撤销。`)) return;
    try {
      await chartsApi.delete(c.id);
      setSnackbar({ open: true, message: '图表已删除', severity: 'success' });
      refreshWorkbook(selectedDatasetId);
    } catch (err) {
      setSnackbar({ open: true, message: `删除失败: ${err.message}`, severity: 'error' });
    }
  };
  const handleDeleteAnalysis = async (e, a) => {
    e.stopPropagation();
    if (!window.confirm(`删除分析结果「${a.type}」?此操作不可撤销。`)) return;
    try {
      await analysesApi.delete(a.id);
      setSnackbar({ open: true, message: '分析结果已删除', severity: 'success' });
      refreshWorkbook(selectedDatasetId);
    } catch (err) {
      setSnackbar({ open: true, message: `删除失败: ${err.message}`, severity: 'error' });
    }
  };
  const handleRegenerateChart = (e, c) => {
    e.stopPropagation();
    navigate(`/charts?dataset=${selectedDatasetId}&project=${selectedProjectId}&type=${c.chart_type}`);
  };

  // 导出 JSON(可复现记录:参数+结果/图规格齐全,可离线复现)—— zcode
  const exportAnalysisJson = (a) => {
    const payload = {
      _export: 'labvault-analysis@v1', id: a.id, type: a.type,
      title: a.title || a.result?.method || '', params: a.params, result: a.result,
      dataset_id: a.dataset_id, project_id: a.project_id, created_at: a.created_at,
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `labvault-analysis-${a.id}.json`);
  };

  // 导出 CSV(摘要表,带 BOM 便于 Excel 直开)—— zcode
  const exportAnalysisCsv = (a) => {
    const summary = a.result?.summary || {};
    const lines = [['指标', '数值 / 描述'],
      ...Object.entries(summary).map(([k, v]) => [k, String(v)])];
    const csv = '\ufeff' + lines.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `labvault-analysis-${a.id}-summary.csv`);
  };
  const exportChartJson = (c) => {
    const payload = {
      _export: 'labvault-chart@v1', id: c.id, chart_type: c.chart_type,
      title: c.title || c.chart_type, plotly: c.plotly,
      dataset_id: c.dataset_id, created_at: c.created_at,
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `labvault-chart-${c.id}.json`);
  };

  // 状态与弹窗
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // 单元格编辑
  const [activeCell, setActiveCell] = useState(null);

  // 加载项目列表
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

  // 加载项目下的数据集
  const loadDatasets = useCallback((projId) => {
    if (!projId) return;
    setLoading(true);
    datasetsApi.list(projId)
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data || res.datasets || [];
        setDatasets(list);
        if (list.length > 0) {
          // URL ?dataset= 深链优先(与统计/图表页双向跳转)—— zcode
          const urlDs = searchParams.get('dataset');
          const dsId = urlDs && list.some(d => String(d.id) === String(urlDs))
            ? urlDs : list[0].id;
          setSelectedDatasetId(dsId);
          loadDatasetDetail(projId, dsId);
        } else {
          setEditingDatasetId(null);
          setDatasetName('新建数据集 1');
          loadTemplate(SAMPLE_TEMPLATES[0]);
        }
      })
      .catch((err) => {
        setSnackbar({ open: true, message: `加载数据集失败: ${err.message}`, severity: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadDatasets(selectedProjectId);
    }
  }, [selectedProjectId, loadDatasets]);

  // 加载具体数据集详情
  const loadDatasetDetail = (projId, dsId) => {
    setLoading(true);
    setSelectedDatasetId(dsId);
    datasetsApi.get(projId, dsId)
      .then((res) => {
        const ds = res.data || res.dataset || res;
        setEditingDatasetId(ds.id);
        setDatasetName(ds.name || '数据集');
        
        // 解析列和数据
        let cols = ds.columns || ds.columns_json;
        if (typeof cols === 'string') {
          try { cols = JSON.parse(cols); } catch { cols = ['Col A', 'Col B']; }
        }
        let data = ds.data || ds.data_json;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { data = []; }
        }

        if (cols && cols.length > 0) {
          setColumns(cols.map(c => typeof c === 'object' ? (c.name || c.field) : String(c)));
        }
        if (Array.isArray(data)) {
          setRows(data.map(r => Array.isArray(r) ? r.map(v => v !== null && v !== undefined ? String(v) : '') : Object.values(r).map(v => String(v))));
        }
        // 快照基线 = 刚载入的内容(脏状态跟踪)—— zcode
        setSavedSnapshot(snapshotOf(
          ds.name || '数据集',
          (cols && cols.length > 0) ? cols.map(c => typeof c === 'object' ? (c.name || c.field) : String(c)) : columns,
          Array.isArray(data) ? data.map(r => Array.isArray(r) ? r.map(v => v !== null && v !== undefined ? String(v) : '') : Object.values(r).map(v => String(v))) : rows
        ));
      })
      .catch((err) => {
        setSnackbar({ open: true, message: `加载详情失败: ${err.message}`, severity: 'warning' });
      })
      .finally(() => setLoading(false));
  };

  // 加载预设模板
  const loadTemplate = (template) => {
    setColumns([...template.columns]);
    setRows(template.data.map(row => [...row]));
    setDatasetName(template.name);
    setSavedSnapshot(snapshotOf(template.name, template.columns, template.data.map(row => [...row])));
    setSnackbar({ open: true, message: `已载入模板：${template.name}`, severity: 'success' });
  };

  // 添加列
  const handleAddColumn = () => {
    const nextChar = String.fromCharCode(65 + (columns.length % 26));
    const newColName = `Column ${nextChar}${columns.length >= 26 ? Math.floor(columns.length / 26) : ''}`;
    setColumns([...columns, newColName]);
    setRows(rows.map(r => [...r, '']));
  };

  // 删除列
  const handleDeleteColumn = (index) => {
    if (columns.length <= 1) {
      setSnackbar({ open: true, message: '至少保留一列', severity: 'warning' });
      return;
    }
    setColumns(columns.filter((_, i) => i !== index));
    setRows(rows.map(r => r.filter((_, i) => i !== index)));
  };

  // 修改列名
  const handleColumnNameChange = (index, newName) => {
    const updated = [...columns];
    updated[index] = newName;
    setColumns(updated);
  };

  // 添加行
  const handleAddRow = () => {
    setRows([...rows, new Array(columns.length).fill('')]);
  };

  // 删除行
  const handleDeleteRow = (index) => {
    if (rows.length <= 1) {
      setRows([new Array(columns.length).fill('')]);
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  // 单元格内容修改
  const handleCellChange = (rowIndex, colIndex, value) => {
    const updated = [...rows];
    updated[rowIndex] = [...updated[rowIndex]];
    updated[rowIndex][colIndex] = value;
    setRows(updated);
  };

  // 处理文本粘贴（从Excel或制表符分隔数据）
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split(/\r?\n/).map(l => l.split(/\t|,/));
    if (lines.length === 0) return;

    // 询问或默认第一行作为表头（如果含有非数字）
    const firstLineIsHeader = lines[0].some(val => isNaN(Number(val.trim())) && val.trim() !== '');
    let newCols = [];
    let newRows = [];

    if (firstLineIsHeader && lines.length > 1) {
      newCols = lines[0].map((v, i) => v.trim() || `Col ${i + 1}`);
      newRows = lines.slice(1).map(line => {
        const row = new Array(newCols.length).fill('');
        line.forEach((val, i) => { if (i < newCols.length) row[i] = val.trim(); });
        return row;
      });
    } else {
      const maxCols = Math.max(...lines.map(l => l.length));
      newCols = Array.from({ length: maxCols }, (_, i) => `Column ${String.fromCharCode(65 + (i % 26))}`);
      newRows = lines.map(line => {
        const row = new Array(maxCols).fill('');
        line.forEach((val, i) => { row[i] = val.trim(); });
        return row;
      });
    }

    setColumns(newCols);
    setRows(newRows);
    setPasteDialogOpen(false);
    setPasteText('');
    setSnackbar({ open: true, message: `成功导入 ${newRows.length} 行数据`, severity: 'success' });
  };

  // 保存数据集
  const handleSaveDataset = async () => {
    if (!selectedProjectId) {
      setSnackbar({ open: true, message: '请先选择或创建项目', severity: 'warning' });
      return;
    }

    // 自动命名:仍为默认名时按 项目名+日期 生成 —— zcode
    let finalName = (datasetName || '').trim();
    if (!finalName || finalName === '未命名数据集') {
      const projName = projects.find(p => p.id === selectedProjectId)?.name || 'LabVault';
      finalName = `${projName}-数据集-${new Date().toLocaleDateString('sv')}`;
      setDatasetName(finalName);
    }

    const payload = {
      name: finalName,
      columns: columns,
      columns_json: JSON.stringify(columns),
      data: rows,
      data_json: JSON.stringify(rows),
      row_count: rows.length,
      col_count: columns.length,
    };

    setLoading(true);
    try {
      if (editingDatasetId) {
        await datasetsApi.update(selectedProjectId, editingDatasetId, payload);
        setSnackbar({ open: true, message: '数据集已更新保存', severity: 'success' });
        setSavedSnapshot(snapshotOf(finalName, columns, rows));
        loadDatasets(selectedProjectId);
        return editingDatasetId;
      } else {
        const res = await datasetsApi.create(selectedProjectId, payload);
        const newDs = res.data || res.dataset || res;
        setEditingDatasetId(newDs.id);
        setSelectedDatasetId(newDs.id);
        setSnackbar({ open: true, message: '新建数据集保存成功', severity: 'success' });
        setSavedSnapshot(snapshotOf(finalName, columns, rows));
        loadDatasets(selectedProjectId);
        return newDs.id;
      }
    } catch (err) {
      setSnackbar({ open: true, message: `保存失败: ${err.message}`, severity: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // GraphPad 式整合:以当前数据表为上下文,一键进入统计/图表(未保存先保存)—— zcode
  const openWithContext = async (target) => {
    let dsId = editingDatasetId;
    if (!dsId) dsId = await handleSaveDataset();
    if (!dsId) {
      setSnackbar({ open: true, message: '需要先保存数据集才能进入分析', severity: 'warning' });
      return;
    }
    navigate(`${target}?dataset=${dsId}&project=${selectedProjectId}`);
  };

  // 处理文件导入
  const handleImportFiles = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setLoading(true);
    try {
      const res = await importApi.upload(file, {
        projectId: selectedProjectId,
        datasetName: file.name.replace(/\.[^/.]+$/, ""),
      });
      setSnackbar({ open: true, message: `成功导入文件 ${file.name}`, severity: 'success' });
      setImportDialogOpen(false);
      loadDatasets(selectedProjectId);
    } catch (err) {
      setSnackbar({ open: true, message: `导入文件失败: ${err.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部工具条 */}
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        {/* 项目与数据集选择 */}
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="project-select-label">所属项目</InputLabel>
            <Select
              labelId="project-select-label"
              value={selectedProjectId}
              label="所属项目"
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="dataset-select-label">数据集</InputLabel>
            <Select
              labelId="dataset-select-label"
              value={selectedDatasetId}
              label="数据集"
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setEditingDatasetId(null);
                  setSelectedDatasetId('__new__');
                  setDatasetName(`新数据集 ${datasets.length + 1}`);
                  setColumns(['Column A', 'Column B', 'Column C']);
                  setRows([['', '', ''], ['', '', ''], ['', '', '']]);
                } else {
                  loadDatasetDetail(selectedProjectId, e.target.value);
                }
              }}
            >
              {datasets.map(d => (
                <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
              ))}
              <MenuItem value="__new__" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                + 新建空白数据集
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label={`数据集名称${isDirty ? '(有未保存更改)' : ''}`}
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            sx={{ width: 220 }}
          />
          {isDirty && (
            <Chip size="small" color="warning" variant="outlined" label="● 未保存更改" />
          )}
        </Stack>

        {/* 操作动作 */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ContentPasteIcon />}
            onClick={() => setPasteDialogOpen(true)}
            size="small"
          >
            粘贴表格
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={() => setImportDialogOpen(true)}
            size="small"
          >
            导入文件
          </Button>
          <Button
            variant="contained"
            color={isDirty ? 'secondary' : 'primary'}
            startIcon={<SaveIcon />}
            onClick={handleSaveDataset}
            disabled={loading}
            size="small"
          >
            {isDirty ? '保存表格 *' : '保存表格'}
          </Button>
        </Stack>
      </Paper>

      {/* 快捷跳转与科研模板 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ScienceIcon fontSize="small" /> 快捷载入模板：
          </Typography>
          {SAMPLE_TEMPLATES.map((tmpl) => (
            <Chip
              key={tmpl.name}
              label={tmpl.name}
              size="small"
              clickable
              onClick={() => loadTemplate(tmpl)}
              variant="outlined"
              color="secondary"
            />
          ))}
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="text"
            startIcon={<CalculateIcon />}
            onClick={() => openWithContext('/statistics')}
          >
            以此数据运行统计
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<BarChartIcon />}
            onClick={() => openWithContext('/charts')}
          >
            生成分析图表
          </Button>
        </Stack>
      </Box>

      {/* 数据表格主体（类似 GraphPad Prism 表格） */}
      <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 表格操作栏 */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'background.tableHeader', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              当前规模: {rows.length} 行 × {columns.length} 列
            </Typography>
            <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 16 }} />
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddColumn}>
              添加列
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
              添加行
            </Button>
            {quickStat && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 16 }} />
                <Chip size="small" color="info" variant="outlined"
                  label={quickStat.kind === 'numeric' ? `快速统计:${quickStat.col}`
                    : quickStat.kind === 'categorical' ? `按组统计:${quickStat.col} → ${quickStat.valCol}`
                    : `${quickStat.col}: 无数值`}
                  onDelete={() => setQuickStatCol(null)} />
                {quickStat.kind === 'numeric' && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="caption" fontFamily="monospace">n={quickStat.n}</Typography>
                    <Typography variant="caption" fontFamily="monospace">
                      mean={quickStat.mean.toFixed(3)} ± {quickStat.sd.toFixed(3)}
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace">
                      [{quickStat.min}, {quickStat.max}]
                    </Typography>
                  </Stack>
                )}
                {quickStat.kind === 'categorical' && (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    {quickStat.details.map(g => (
                      <Chip key={g.name} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }}
                        label={`${g.name} ${g.mean.toFixed(3)}±${g.sd.toFixed(3)} (n=${g.n})`} />
                    ))}
                  </Stack>
                )}
              </>
            )}
            {groupCompare && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 16 }} />
                <Typography variant="caption" color="text.secondary">
                  分组均值({groupCompare.catCol}→{groupCompare.valCol}):
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {groupCompare.details.map(g => (
                    <Tooltip key={g.name} title={`${g.name}: n=${g.n}, mean±SD`}>
                      <Chip size="small" variant="outlined" sx={{ fontFamily: 'monospace' }}
                        label={`${g.name} ${g.mean.toFixed(3)}±${g.sd.toFixed(3)} (n=${g.n})`} />
                    </Tooltip>
                  ))}
                </Stack>
                <Button size="small" variant="outlined" color="secondary"
                  onClick={() => openWithContext('/statistics')}>
                  按组对比 (t 检验)
                </Button>
              </>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            双击单元格或表头即可编辑修改
          </Typography>
        </Box>

        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 60, bgcolor: 'background.tableHeader', color: 'text.secondary', fontWeight: 700 }}>
                  #
                </TableCell>
                {columns.map((col, colIdx) => (
                  <TableCell
                    key={colIdx}
                    sx={{
                      minWidth: 160,
                      bgcolor: 'background.tableHeader',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                      py: 0.5,
                      px: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <TextField
                        variant="standard"
                        value={col}
                        onChange={(e) => handleColumnNameChange(colIdx, e.target.value)}
                        InputProps={{
                          disableUnderline: true,
                          sx: { fontWeight: 600, fontSize: '0.85rem' }
                        }}
                      />
                      <Tooltip title="快速统计该列 (n / mean±SD)">
                        <IconButton
                          size="small"
                          onClick={() => setQuickStatCol(quickStatCol === colIdx ? null : colIdx)}
                          sx={{ opacity: 0.5, '&:hover': { opacity: 1 }, ...(quickStatCol === colIdx ? { color: 'primary.main', opacity: 1 } : {}) }}
                        >
                          <BarChartIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除该列">
                        <IconButton size="small" onClick={() => handleDeleteColumn(colIdx)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                          <DeleteOutlineIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, rowIdx) => (
                <TableRow key={rowIdx} hover>
                  <TableCell
                    align="center"
                    sx={{
                      width: 60,
                      bgcolor: 'background.tableHeader',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      userSelect: 'none',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <span>{rowIdx + 1}</span>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteRow(rowIdx)}
                        sx={{ p: 0.2, opacity: 0.3, '&:hover': { opacity: 1, color: 'error.main' } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  </TableCell>

                  {columns.map((_, colIdx) => (
                    <TableCell
                      key={colIdx}
                      sx={{
                        p: 0,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'rgba(21,101,192,0.02)' },
                      }}
                    >
                      <input
                        type="text"
                        value={row[colIdx] || ''}
                        onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                        style={{
                          width: '100%',
                          height: '32px',
                          border: 'none',
                          outline: 'none',
                          padding: '0 8px',
                          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                          fontSize: '13px',
                          background: 'transparent',
                          color: 'inherit',
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 粘贴数据弹窗 */}
      <Dialog open={pasteDialogOpen} onClose={() => setPasteDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>从剪贴板粘贴表格数据</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            支持直接从 Excel、WPS、Google Sheets 或文本文件中复制数据并粘贴于下方。系统会自动按制表符（Tab）或逗号识别单元格。
          </Typography>
          <TextField
            multiline
            rows={10}
            fullWidth
            placeholder={"Concentration\tControl\tTreated\n0.1\t98.2\t85.4\n1.0\t95.0\t60.2\n10.0\t92.1\t20.5"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            InputProps={{
              sx: { fontFamily: 'monospace', fontSize: '0.85rem' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPasteDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
            解析并导入表格
          </Button>
        </DialogActions>
      </Dialog>

      {/* 工作簿:数据集已保存的分析结果与图表(Prism 式 Results/Graphs)—— zcode */}
      {selectedDatasetId && (
        <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
          <Stack
            direction="row" alignItems="center" justifyContent="space-between"
            onClick={() => setWbOpen(!wbOpen)} sx={{ cursor: 'pointer' }}
          >
            <Typography variant="body2" fontWeight={600}>
              工作簿:图表 {workbook.charts.length} · 分析结果 {workbook.analyses.length}
            </Typography>
            <Chip size="small" label={wbOpen ? '收起' : '展开'} variant="outlined" />
          </Stack>
          {wbOpen && (workbook.analyses.length === 0 && workbook.charts.length === 0) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              此数据集暂无已保存结果 —— 点上方「以此数据运行统计」或「生成分析图表」,结果会自动保存到这里。
            </Typography>
          )}
          {wbOpen && (workbook.analyses.length > 0 || workbook.charts.length > 0) && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {workbook.charts.map((c) => (
                <Stack
                  key={`c${c.id}`} direction="row" spacing={1} alignItems="center"
                  onClick={() => setViewChart(c)} sx={{ cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <Chip size="small" color="primary" variant="outlined" label="图" sx={{ minWidth: 32 }} />
                  <Typography variant="body2">{c.title || c.chart_type}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.created_at}</Typography>
                  <Tooltip title="重命名图表">
                    <IconButton size="small" onClick={(e) => {
                      e.stopPropagation();
                      const t = window.prompt('图表新标题:', c.title || c.chart_type);
                      if (t && t.trim() && t.trim() !== c.title) {
                        chartsApi.rename(c.id, t.trim())
                          .then(() => { setSnackbar({ open: true, message: '图表已重命名', severity: 'success' }); refreshWorkbook(selectedDatasetId); })
                          .catch((err) => setSnackbar({ open: true, message: `重命名失败: ${err.message}`, severity: 'error' }));
                      }
                    }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="导出 JSON(可复现图规格)">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); exportChartJson(c); }}>
                      <DownloadIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="以此数据集与图型重新生成">
                    <IconButton size="small" onClick={(e) => handleRegenerateChart(e, c)}>
                      <RefreshIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除图表">
                    <IconButton size="small" onClick={(e) => handleDeleteChart(e, c)}>
                      <DeleteOutlineIcon sx={{ fontSize: 15, color: 'error.main' }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
              {workbook.analyses.map((a) => (
                <Box key={`a${a.id}`}>
                  <Stack
                    direction="row" spacing={1} alignItems="center"
                    onClick={() => setExpandedAnalysis(expandedAnalysis === a.id ? null : a.id)}
                    sx={{ cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <Chip size="small" color="secondary" variant="outlined" label="析" sx={{ minWidth: 32 }} />
                    <Typography variant="body2">
                      {a.title || `${a.type}${a.result?.method ? ` · ${a.result.method}` : ''}`}
                      {a.result?.summary?.结论 ? ` · ${a.result.summary.结论}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{a.created_at}</Typography>
                    <Tooltip title="导出 CSV(摘要表,Excel 直开)">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); exportAnalysisCsv(a); }}>
                        <TableChartIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="导出 JSON(可复现分析记录)">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); exportAnalysisJson(a); }}>
                        <DownloadIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="重命名分析">
                      <IconButton size="small" onClick={(e) => {
                        e.stopPropagation();
                        const t = window.prompt('分析条目新标题:', a.title || `${a.type} · ${a.result?.method || ''}`);
                        if (t && t.trim() && t.trim() !== a.title) {
                          analysesApi.rename(a.id, t.trim())
                            .then(() => { setSnackbar({ open: true, message: '分析已重命名', severity: 'success' }); refreshWorkbook(selectedDatasetId); })
                            .catch((err) => setSnackbar({ open: true, message: `重命名失败: ${err.message}`, severity: 'error' }));
                        }
                      }}>
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small" variant="outlined" color="secondary"
                      startIcon={<BarChartIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/charts?dataset=${selectedDatasetId}&project=${selectedProjectId}&analysis=${a.id}`);
                      }}
                    >
                      从该分析出图
                    </Button>
                    <Tooltip title="删除分析结果">
                      <IconButton size="small" onClick={(e) => handleDeleteAnalysis(e, a)}>
                        <DeleteOutlineIcon sx={{ fontSize: 15, color: 'error.main' }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  {expandedAnalysis === a.id && a.result?.summary && (
                    <Box sx={{ ml: 5, mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                      {Object.entries(a.result.summary).map(([k, v]) => (
                        <Typography key={k} variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
                          {k}: {String(v)}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {/* 工作簿图表回看弹窗 —— zcode */}
      <Dialog open={!!viewChart} onClose={() => setViewChart(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {viewChart?.title || viewChart?.chart_type}
          <Typography variant="caption" color="text.secondary">{viewChart?.created_at}</Typography>
        </DialogTitle>
        <DialogContent>
          {viewChart && (
            <ChartViewer
              data={viewChart.plotly?.data || []}
              layout={viewChart.plotly?.layout || {}}
              title=""
              height={420}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="outlined" color="secondary" size="small"
            startIcon={<EditIcon />}
            onClick={() => {
              navigate(`/charts?dataset=${selectedDatasetId}&project=${selectedProjectId}&type=${viewChart.chart_type}`);
              setViewChart(null);
            }}
          >
            在图表构建器中打开
          </Button>
          <Button onClick={() => setViewChart(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 文件导入弹窗 */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>导入实验数据文件</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <DataImport onFiles={handleImportFiles} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setImportDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 提示消息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ZCODE_MARKER_XYZ9182
