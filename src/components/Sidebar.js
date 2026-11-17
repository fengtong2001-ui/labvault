import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Tooltip,
  IconButton,
  Avatar,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/FolderOpen';
import TableChartIcon from '@mui/icons-material/TableChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import CalculateIcon from '@mui/icons-material/Calculate';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ScienceIcon from '@mui/icons-material/Science';

const NAV_ITEMS = [
  { label: '仪表盘',   path: '/dashboard',  icon: <DashboardIcon fontSize="small" /> },
  { label: '项目管理', path: '/projects',   icon: <FolderIcon fontSize="small" /> },
  { divider: true },
  { label: '数据表格', path: '/data',       icon: <TableChartIcon fontSize="small" /> },
  { label: '图表构建', path: '/charts',     icon: <BarChartIcon fontSize="small" /> },
  { label: '统计分析', path: '/statistics', icon: <CalculateIcon fontSize="small" /> },
  { divider: true },
  { label: '导出',     path: '/export',     icon: <FileDownloadIcon fontSize="small" /> },
];

export default function Sidebar({ width, isDark, onToggleTheme, currentProject }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <Box
      sx={{
        width,
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        bgcolor: isDark ? '#111827' : '#1A2332',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1200,
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo 区 */}
      <Box
        sx={{
          px: 2.5,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'primary.main',
            borderRadius: 1.5,
          }}
        >
          <ScienceIcon sx={{ fontSize: 18 }} />
        </Avatar>
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: '0.95rem',
            }}
          >
            LabVault
          </Typography>
          <Typography
            sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}
          >
            科研数据管理系统
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* 当前项目指示 */}
      {currentProject && (
        <Box
          sx={{
            mx: 1.5,
            mt: 1.5,
            px: 1.5,
            py: 1,
            bgcolor: 'rgba(21,101,192,0.3)',
            borderRadius: 1.5,
            border: '1px solid rgba(21,101,192,0.5)',
          }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', mb: 0.3 }}>
            当前项目
          </Typography>
          <Typography
            noWrap
            sx={{ color: '#90CAF9', fontSize: '0.8rem', fontWeight: 600 }}
          >
            {currentProject.name}
          </Typography>
        </Box>
      )}

      {/* 导航列表 */}
      <List sx={{ flex: 1, px: 1, py: 1.5, overflowY: 'auto' }}>
        {NAV_ITEMS.map((item, idx) => {
          if (item.divider) {
            return (
              <Divider
                key={idx}
                sx={{ my: 0.75, borderColor: 'rgba(255,255,255,0.06)' }}
              />
            );
          }

          const active = pathname === item.path;

          return (
            <Tooltip key={item.path} title="" placement="right">
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.3,
                  py: 0.9,
                  px: 1.5,
                  bgcolor: active ? 'rgba(21,101,192,0.5)' : 'transparent',
                  '&:hover': {
                    bgcolor: active
                      ? 'rgba(21,101,192,0.6)'
                      : 'rgba(255,255,255,0.07)',
                  },
                  transition: 'background-color 0.15s',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 32,
                    color: active ? '#90CAF9' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  }}
                />
                {active && (
                  <Box
                    sx={{
                      width: 3,
                      height: 20,
                      bgcolor: 'primary.light',
                      borderRadius: 2,
                      position: 'absolute',
                      right: 4,
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* 底部工具栏 */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Tooltip title={isDark ? '切换浅色模式' : '切换深色模式'}>
          <IconButton onClick={onToggleTheme} size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
