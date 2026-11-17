import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import CalculateIcon from '@mui/icons-material/Calculate';
import ScienceIcon from '@mui/icons-material/Science';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useNavigate } from 'react-router-dom';
import { datasetsApi, projectsApi, importApi } from '../utils/api';
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
  const [selectedProjectId, setSelectedProjectId] = useState(currentProject?.id || '');
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  
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
          loadDatasetDetail(projId, list[0].id);
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

    const payload = {
      name: datasetName,
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
        loadDatasets(selectedProjectId);
        return editingDatasetId;
      } else {
        const res = await datasetsApi.create(selectedProjectId, payload);
        const newDs = res.data || res.dataset || res;
        setEditingDatasetId(newDs.id);
        setSelectedDatasetId(newDs.id);
        setSnackbar({ open: true, message: '新建数据集保存成功', severity: 'success' });
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
            label="数据集名称"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            sx={{ width: 220 }}
          />
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
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveDataset}
            disabled={loading}
            size="small"
          >
            保存表格
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
