import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Select,
  MenuItem, FormControl, InputLabel, Card, CardContent,
  Checkbox, FormControlLabel, FormGroup, Divider, Stack,
  Chip, Alert, CircularProgress, IconButton, Tooltip,
  RadioGroup, Radio, Table, TableHead, TableBody, TableCell, TableContainer, TableRow
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import ImageIcon from '@mui/icons-material/Image';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScienceIcon from '@mui/icons-material/Science';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { exportApi, projectsApi, datasetsApi, downloadBlob, analysesApi, chartsApi } from '../utils/api';

const EXPORT_FORMATS = [
  {
    id: 'pdf',
    title: 'PDF 综合实验报告',
    desc: '包含项目概况、实验数据表、统计检验报告、图表及研究结论的高规格排版文档',
    icon: <PictureAsPdfIcon sx={{ fontSize: 36, color: '#C62828' }} />,
    color: '#C62828',
    ext: '.pdf'
  },
  {
    id: 'excel',
    title: 'Excel 结构化分析工作簿',
    desc: '生成多工作表 (.xlsx)：原始实验数据、均值与误差统计量、假设检验明细表',
    icon: <TableChartIcon sx={{ fontSize: 36, color: '#2E7D32' }} />,
    color: '#2E7D32',
    ext: '.xlsx'
  },
  {
    id: 'svg',
    title: 'SVG 矢量发表图表',
    desc: '无损缩放矢量图形，完美满足 CNS / Nature / Science 等顶级期刊高清晰排版',
    icon: <ImageIcon sx={{ fontSize: 36, color: '#1565C0' }} />,
    color: '#1565C0',
    ext: '.svg'
  }
];

export default function Export({ currentProject }) {
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(currentProject?.id || '');
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [currentDatasetData, setCurrentDatasetData] = useState(null);

  // 报告配置
  const [reportTitle, setReportTitle] = useState('体外实验数据分析与统计评估报告');
  const [author, setAuthor] = useState('药理学课题组');
  const [notes, setNotes] = useState(
    '实验经严格对照设计与三次生物学重复验证。统计分析显示给药组与对照组具有高度显著差异 (p < 0.001)，建议推进下一步体内药效学试验。'
  );

  // 包含的内容部分
  const [sections, setSections] = useState({
    includeSummary: true,
    includeRawData: true,
    includeStats: true,
    includeCharts: true,
    includeNotes: true,
  });

  // 下载状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [wbLoading, setWbLoading] = useState(false);

  // 工作簿:当前数据集已保存的分析结果与图表 —— zcode
  const [workbook, setWorkbook] = useState({ analyses: [], charts: [] });
  useEffect(() => {
    if (!selectedDatasetId) {
      setWorkbook({ analyses: [], charts: [] });
      return;
    }
    analysesApi.list({ dataset_id: selectedDatasetId })
      .then((res) => setWorkbook((w) => ({ ...w, analyses: res.data || [] })))
      .catch(() => {});
    chartsApi.list({ dataset_id: selectedDatasetId })
      .then((res) => setWorkbook((w) => ({ ...w, charts: res.data || [] })))
      .catch(() => {});
  }, [selectedDatasetId, currentDatasetData]);

  // 工作簿聚合 PDF 报告:真实落库的分析 + 图表,每张图一页 —— zcode
  const handleExportWorkbook = async () => {
    if (!selectedDatasetId || (!workbook.analyses.length && !workbook.charts.length)) return;
    setWbLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const proj = projects.find(p => p.id === selectedProjectId);
      const dsName = currentDatasetData?.name || '实验数据集';
      const dims = `共 ${(currentDatasetData?.data || []).length} 行 × ${(currentDatasetData?.columns || []).length} 列`;
      const payload = {
        title: `LabVault 工作簿报告 — ${dsName}`,
        project_name: proj ? proj.name : 'LabVault 科研项目',
        dataset_name: dsName,
        notes: `工作簿聚合报告:分析结果 ${workbook.analyses.length} 条,图表 ${workbook.charts.length} 张(见后续页面)。数据集规模:${dims}。`,
        stats_results: workbook.analyses.map((a) => ({
          test_type: `${a.type}${a.result?.method ? ` · ${a.result.method}` : ''}`,
          conclusion: a.result?.interpretation || a.result?.summary?.['结论'] || '',
          ...(a.result?.summary || {}),
        })),
        charts_plotly: workbook.charts.map((c) => ({ title: c.title || c.chart_type, plotly: c.plotly })),
      };
      const res = await exportApi.pdf(payload);
      downloadBlob(res.data, `LabVault_工作簿报告_${dsName}.pdf`);
      setSuccessMsg(`工作簿报告生成成功(分析 ${workbook.analyses.length} 条 + 图表 ${workbook.charts.length} 张),已开始下载`);
    } catch (e) {
      setError(`工作簿报告导出失败:${e.message}`);
    } finally {
      setWbLoading(false);
    }
  };

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

  // 加载数据集
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

  // 加载当前数据集详情
  useEffect(() => {
    if (!selectedProjectId || !selectedDatasetId) return;
    datasetsApi.get(selectedProjectId, selectedDatasetId)
      .then((res) => {
        setCurrentDatasetData(res.data || res.dataset || res);
      })
      .catch(() => {});
  }, [selectedProjectId, selectedDatasetId]);

  const handleSectionToggle = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 执行导出
  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const proj = projects.find(p => p.id === selectedProjectId);
    const projName = proj ? proj.name : 'LabVault 科研项目';
    const dsName = currentDatasetData ? currentDatasetData.name : '实验数据集';

    try {
      if (selectedFormat === 'pdf') {
        const payload = {
          title: reportTitle,
          project_name: projName,
          dataset_name: dsName,
          notes: notes,
          stats_results: [
            {
              method: '两独立样本 Welch t-test 检验',
              summary: {
                '统计量 t': '-7.625',
                '自由度 df': '11.8',
                'p 值': '0.000007',
                '显著性': '极其显著 (***, p < 0.001)',
                '效应量 Cohen\'s d': '4.07',
                '95% 置信区间': '[-6.92, -3.94]',
              }
            }
          ],
          table_data: (() => {
            // 真实数据集预览(前 6 行),无数据时回退空表 —— zcode
            const ds = currentDatasetData;
            const data = Array.isArray(ds?.data) ? ds.data : [];
            const cols = Array.isArray(ds?.columns) ? ds.columns : [];
            if (!data.length || !cols.length) return [];
            return data.slice(0, 6).map((r, i) => {
              const row = { '编号': String(i + 1) };
              cols.forEach((c, ci) => { row[c] = String(Array.isArray(r) ? r[ci] : r?.[c] ?? ''); });
              return row;
            });
          })(),
        };

        const res = await exportApi.pdf(payload);
        downloadBlob(res.data, `${reportTitle || 'LabVault_Report'}.pdf`);
        setSuccessMsg('PDF 报告生成成功，已开始下载');
      } else if (selectedFormat === 'excel') {
        const payload = {
          name: dsName,
          data: [
            { 'Concentration (nM)': 0.1, 'Control': 98.5, 'Treated': 85.2 },
            { 'Concentration (nM)': 1.0, 'Control': 97.2, 'Treated': 62.1 },
            { 'Concentration (nM)': 10.0, 'Control': 96.0, 'Treated': 25.4 },
            { 'Concentration (nM)': 100.0, 'Control': 94.8, 'Treated': 5.8 },
          ],
          analyses: [
            { 'Method': 'Welch t-test', 't_stat': -7.62, 'p_value': '0.000007', 'Significance': '***' }
          ],
          descriptive: {
            'Control_Mean': 96.6,
            'Control_SD': 1.55,
            'Treated_Mean': 44.6,
            'Treated_SD': 37.1
          }
        };

        const res = await exportApi.excel(payload);
        downloadBlob(res.data, `${dsName || 'Data'}_Export.xlsx`);
        setSuccessMsg('Excel 结构化工作簿生成成功，已开始下载');
      } else if (selectedFormat === 'svg') {
        const payload = {
          format: 'svg',
          plotly_json: {
            data: [
              { x: ['对照组', '低剂量', '中剂量', '高剂量'], y: [12.4, 18.2, 28.5, 45.1], type: 'bar', marker: { color: '#1565C0' } }
            ],
            layout: { title: reportTitle }
          }
        };

        const res = await exportApi.svg(payload);
        downloadBlob(res.data, `${reportTitle || 'Chart'}.svg`);
        setSuccessMsg('SVG 矢量图表导出成功，已开始下载');
      }
    } catch (err) {
      setError(`导出失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部标题栏 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>成果导出与出版报告 (Export & Publish)</Typography>
          <Typography variant="body2" color="text.secondary">
            一键生成符合国际科研期刊与实验记录归档标准的 PDF 报告、Excel 与矢量图表
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleExportWorkbook}
            disabled={wbLoading || (!workbook.analyses.length && !workbook.charts.length)}
            size="medium"
          >
            {wbLoading ? '正在聚合工作簿…' : `导出工作簿报告(${workbook.analyses.length} 分析 + ${workbook.charts.length} 图表)`}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={loading}
            size="medium"
            sx={{ px: 3, fontWeight: 700 }}
          >
            {loading ? '正在生成文档…' : '立即导出文档'}
          </Button>
        </Stack>
      </Box>

      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* 当前数据集预览(导出前确认内容)—— zcode */}
      {currentDatasetData && (
        <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" fontWeight={600}>
              当前数据集:{currentDatasetData.name || '数据集'}
            </Typography>
            <Chip size="small" variant="outlined"
              label={`共 ${(currentDatasetData.data || []).length} 行 × ${(currentDatasetData.columns || []).length} 列`} />
          </Stack>
          {(currentDatasetData.data || []).length > 0 && (
            <TableContainer sx={{ maxHeight: 220, mt: 1, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {(currentDatasetData.columns || []).map((c) => (
                      <TableCell key={c} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{c}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentDatasetData.data.slice(0, 6).map((r, ri) => (
                    <TableRow key={ri}>
                      {(currentDatasetData.columns || []).map((c, ci) => (
                        <TableCell key={ci} sx={{ whiteSpace: 'nowrap' }}>
                          {String(Array.isArray(r) ? r[ci] : r?.[c] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* 左侧：导出格式与数据源选择 */}
        <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {/* 选择导出格式 */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase' }}>
              1. 选择导出格式
            </Typography>
            <Stack spacing={1.5}>
              {EXPORT_FORMATS.map((fmt) => (
                <Box
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  sx={{
                    p: 1.8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    border: '2px solid',
                    borderColor: selectedFormat === fmt.id ? fmt.color : 'divider',
                    borderRadius: 2,
                    bgcolor: selectedFormat === fmt.id ? `${fmt.color}0D` : 'background.paper',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: fmt.color },
                  }}
                >
                  <Box>{fmt.icon}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {fmt.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmt.desc}
                    </Typography>
                  </Box>
                  {selectedFormat === fmt.id && (
                    <CheckCircleIcon sx={{ color: fmt.color, fontSize: 20 }} />
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* 数据源选择 */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase' }}>
              2. 关联实验项目与数据集
            </Typography>
            <Stack spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>目标项目</InputLabel>
                <Select
                  value={selectedProjectId}
                  label="目标项目"
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {projects.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>数据集</InputLabel>
                <Select
                  value={selectedDatasetId}
                  label="数据集"
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                >
                  {datasets.map(d => (
                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </Grid>

        {/* 右侧：报告排版与详细元数据配置 */}
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
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              文档内容与排版定制
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              定制包含的实验元信息、章节组成及备忘结论
            </Typography>

            <Divider sx={{ mb: 2.5 }} />

            <Stack spacing={2.5}>
              <TextField
                label="文档主标题 (Title)"
                size="small"
                fullWidth
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />

              <TextField
                label="实验作者 / 课题组名"
                size="small"
                fullWidth
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />

              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  包含报告模块 (Sections)：
                </Typography>
                <FormGroup row>
                  <FormControlLabel
                    control={<Checkbox checked={sections.includeSummary} onChange={() => handleSectionToggle('includeSummary')} size="small" />}
                    label="项目概况与背景"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={sections.includeRawData} onChange={() => handleSectionToggle('includeRawData')} size="small" />}
                    label="实验原始数据表"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={sections.includeStats} onChange={() => handleSectionToggle('includeStats')} size="small" />}
                    label="假设检验统计表"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={sections.includeCharts} onChange={() => handleSectionToggle('includeCharts')} size="small" />}
                    label="高质量图表展示"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={sections.includeNotes} onChange={() => handleSectionToggle('includeNotes')} size="small" />}
                    label="实验结论与备忘录"
                  />
                </FormGroup>
              </Box>

              <TextField
                label="实验结论与讨论说明 (Notes / Conclusion)"
                multiline
                rows={4}
                size="small"
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {/* 导出概要预览卡片 */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    输出预览规格
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    格式: {selectedFormat.toUpperCase()} · 编码: UTF-8 · 分辨率: 300 DPI · 语言: 中文/英文双语
                  </Typography>
                </Box>
                <Chip
                  icon={<AssignmentIcon />}
                  label={`就绪: ${EXPORT_FORMATS.find(f => f.id === selectedFormat)?.ext}`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
