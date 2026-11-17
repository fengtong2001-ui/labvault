import React, { useRef, useEffect } from 'react';
import Plot from 'react-plotly.js';
import {
  Box,
  Skeleton,
  Typography,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';

const DEFAULT_CONFIG = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['sendDataToCloud', 'toImage'],
  displaylogo: false,
  scrollZoom: true,
  locale: 'zh-CN',
};

const DEFAULT_LAYOUT = {
  font: { family: "'Inter', sans-serif", size: 13 },
  margin: { l: 60, r: 20, t: 50, b: 60 },
  plot_bgcolor: 'rgba(0,0,0,0)',
  paper_bgcolor: 'rgba(0,0,0,0)',
  legend: {
    orientation: 'h',
    yanchor: 'bottom',
    y: -0.25,
    xanchor: 'center',
    x: 0.5,
  },
};

export default function ChartViewer({
  data = [],
  layout = {},
  title,
  loading = false,
  error = null,
  height = 420,
  onRefresh,
  onDownload,
  showToolbar = true,
}) {
  const plotRef = useRef(null);

  const mergedLayout = {
    ...DEFAULT_LAYOUT,
    ...layout,
    title: title
      ? { text: title, font: { size: 15, family: "'Inter', sans-serif" } }
      : layout.title,
  };

  const handleFullscreen = () => {
    const el = plotRef.current?.el;
    if (el && el.requestFullscreen) el.requestFullscreen();
  };

  if (loading) {
    return (
      <Box sx={{ p: 1 }}>
        <Skeleton variant="rectangular" width="100%" height={height} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          gap: 1,
        }}
      >
        <Typography variant="body2" color="error.main">
          图表加载失败
        </Typography>
        <Typography variant="caption">{error}</Typography>
        {onRefresh && (
          <IconButton size="small" onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        )}
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          color: 'text.disabled',
        }}
      >
        <Typography variant="body2">暂无图表数据</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* 工具栏 */}
      {showToolbar && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            zIndex: 10,
          }}
        >
          {onRefresh && (
            <Tooltip title="刷新图表">
              <IconButton size="small" onClick={onRefresh} sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDownload && (
            <Tooltip title="下载图表">
              <IconButton size="small" onClick={onDownload} sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="全屏">
            <IconButton size="small" onClick={handleFullscreen} sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {/* Plotly 图表 */}
      <Plot
        ref={plotRef}
        data={data}
        layout={mergedLayout}
        config={DEFAULT_CONFIG}
        style={{ width: '100%', height }}
        useResizeHandler
      />
    </Box>
  );
}
