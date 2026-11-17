import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/** 将 p 值转换为显著性符号 */
function pToStar(p) {
  if (p === null || p === undefined || isNaN(p)) return 'N/A';
  if (p > 0.05) return 'ns';
  if (p > 0.01) return '*';
  if (p > 0.001) return '**';
  return '***';
}

/** 显著性颜色 */
function sigColor(p) {
  if (p === null || p === undefined || isNaN(p)) return 'default';
  if (p > 0.05) return 'default';
  if (p > 0.01) return 'warning';
  if (p > 0.001) return 'error';
  return 'error';
}

/** 格式化数字 */
function fmt(val, digits = 4) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? '是' : '否';
  if (typeof val === 'string') return val;
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(3);
  return n.toFixed(digits);
}

// ─────────────────────────────────────────────
// 主统计量表
// ─────────────────────────────────────────────
function SummaryTable({ summary }) {
  if (!summary) return null;
  const rows = Object.entries(summary);
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
      <Table size="small">
        <TableBody>
          {rows.map(([key, val]) => (
            <TableRow key={key} hover>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: '45%' }}>
                {key}
              </TableCell>
              <TableCell sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                {fmt(val)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─────────────────────────────────────────────
// 两组比较行（带显著性）
// ─────────────────────────────────────────────
function ComparisonTable({ comparisons }) {
  if (!comparisons || comparisons.length === 0) return null;
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>比较组</TableCell>
            <TableCell>统计量</TableCell>
            <TableCell>p 值</TableCell>
            <TableCell>显著性</TableCell>
            <TableCell>效应量</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {comparisons.map((row, idx) => (
            <TableRow key={idx} hover>
              <TableCell sx={{ fontWeight: 500 }}>
                {row.group || `${row.group1} vs ${row.group2}`}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>
                {fmt(row.statistic ?? row.t ?? row.F ?? row.U)}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>
                {fmt(row.p_value ?? row.p, 4)}
              </TableCell>
              <TableCell>
                <Chip
                  label={pToStar(row.p_value ?? row.p)}
                  size="small"
                  color={sigColor(row.p_value ?? row.p)}
                  variant={pToStar(row.p_value ?? row.p) === 'ns' ? 'outlined' : 'filled'}
                />
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>
                {fmt(row.effect_size ?? row.cohen_d ?? row.eta_squared, 3)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─────────────────────────────────────────────
// 主导出组件
// ─────────────────────────────────────────────
export default function StatResults({ results, method, loading, error }) {
  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">正在计算…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!results) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          color: 'text.disabled',
        }}
      >
        <Typography variant="body2">配置参数后运行分析</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 方法标题 */}
      {method && (
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {method}
        </Typography>
      )}

      {/* 解释说明 */}
      {results.interpretation && (
        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2, fontSize: '0.85rem' }}>
          {results.interpretation}
        </Alert>
      )}

      {/* 主摘要统计量 */}
      {results.summary && (
        <Accordion defaultExpanded disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', mb: 1.5 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600} fontSize="0.875rem">统计摘要</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <SummaryTable summary={results.summary} />
          </AccordionDetails>
        </Accordion>
      )}

      {/* 多重比较 */}
      {results.comparisons && (
        <Accordion defaultExpanded disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', mb: 1.5 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600} fontSize="0.875rem">
              {results.comparisons.length > 1 ? '多重比较结果' : '检验结果'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <ComparisonTable comparisons={results.comparisons} />
            {/* 显著性说明 */}
            <Box sx={{ mt: 1.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {[
                { label: 'ns  p > 0.05', color: 'default' },
                { label: '*  p ≤ 0.05', color: 'warning' },
                { label: '**  p ≤ 0.01', color: 'error' },
                { label: '***  p ≤ 0.001', color: 'error' },
              ].map(({ label, color }) => (
                <Chip key={label} label={label} size="small" color={color} variant="outlined" sx={{ fontSize: '0.72rem' }} />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* 额外详情（如回归系数、拟合优度等） */}
      {results.details && (
        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600} fontSize="0.875rem">详细结果</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SummaryTable summary={results.details} />
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}
