import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, CardActionArea, Typography,
  Button, Chip, Skeleton, Avatar, Divider, Stack, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import TableChartIcon from '@mui/icons-material/TableChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import CalculateIcon from '@mui/icons-material/Calculate';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { projectsApi } from '../utils/api';

const QUICK_ACTIONS = [
  {
    label: '新建项目',
    icon: <AddIcon />,
    path: '/projects',
    color: '#1565C0',
    desc: '创建新的科研数据项目',
  },
  {
    label: '录入数据',
    icon: <TableChartIcon />,
    path: '/data',
    color: '#00897B',
    desc: '手动录入或粘贴数据',
  },
  {
    label: '绘制图表',
    icon: <BarChartIcon />,
    path: '/charts',
    color: '#6A1B9A',
    desc: '生成并自定义图表',
  },
  {
    label: '统计分析',
    icon: <CalculateIcon />,
    path: '/statistics',
    color: '#E65100',
    desc: 't检验、ANOVA、回归等',
  },
];

function StatCard({ label, value, unit, icon, color }) {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: `${color}18`, width: 40, height: 40 }}>
            <Box sx={{ color }}>{icon}</Box>
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project, onOpen }) {
  return (
    <Card>
      <CardActionArea onClick={() => onOpen(project)} sx={{ p: 0 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {project.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1 }}>
                {project.description || '暂无描述'}
              </Typography>
            </Box>
            <Chip
              label={project.status || '进行中'}
              size="small"
              color={project.status === '已完成' ? 'success' : 'primary'}
              variant="outlined"
              sx={{ ml: 1, flexShrink: 0 }}
            />
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
            <AccessTimeIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">
              {project.updated_at
                ? new Date(project.updated_at).toLocaleDateString('zh-CN')
                : '未知时间'}
            </Typography>
            {project.dataset_count !== undefined && (
              <>
                <Box sx={{ mx: 1, fontSize: 12 }}>·</Box>
                <Typography variant="caption">{project.dataset_count} 个数据集</Typography>
              </>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Dashboard({ onOpenProject, currentProject }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    projectsApi.list()
      .then((data) => {
        setProjects(Array.isArray(data) ? data : data.data || data.projects || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const recentProjects = projects.slice(0, 6);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* 页头 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          欢迎使用 LabVault
        </Typography>
        <Typography color="text.secondary" variant="body2">
          专业科研数据管理与可视化平台
        </Typography>
      </Box>

      {/* 统计卡片 */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <StatCard
          label="总项目数"
          value={loading ? '—' : projects.length}
          icon={<FolderOpenIcon />}
          color="#1565C0"
        />
        <StatCard
          label="数据集"
          value={loading ? '—' : projects.reduce((s, p) => s + (p.dataset_count || 0), 0)}
          icon={<TableChartIcon />}
          color="#00897B"
        />
        <StatCard
          label="近期活跃"
          value={loading ? '—' : recentProjects.length}
          icon={<TrendingUpIcon />}
          color="#6A1B9A"
        />
      </Stack>

      <Grid container spacing={3}>
        {/* 快捷操作 */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                快捷操作
              </Typography>
              <Stack spacing={1}>
                {QUICK_ACTIONS.map((action) => (
                  <Box
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      border: '1px solid transparent',
                      '&:hover': {
                        bgcolor: `${action.color}0C`,
                        border: `1px solid ${action.color}30`,
                      },
                      transition: 'all 0.15s',
                    }}
                  >
                    <Avatar sx={{ bgcolor: `${action.color}18`, width: 36, height: 36 }}>
                      <Box sx={{ color: action.color, display: 'flex', fontSize: 18 }}>{action.icon}</Box>
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>{action.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{action.desc}</Typography>
                    </Box>
                    <ArrowForwardIcon sx={{ color: 'text.disabled', fontSize: 16 }} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* 近期项目 */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                  近期项目
                </Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/projects')}>
                  全部项目
                </Button>
              </Box>

              {error && (
                <Typography color="error.main" variant="body2" sx={{ mb: 2 }}>
                  加载失败：{error} — 请确保后端服务已启动
                </Typography>
              )}

              {loading ? (
                <Grid container spacing={1.5}>
                  {[1, 2, 3, 4].map((i) => (
                    <Grid item xs={12} sm={6} key={i}>
                      <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} />
                    </Grid>
                  ))}
                </Grid>
              ) : recentProjects.length === 0 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 4,
                    color: 'text.disabled',
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <FolderOpenIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                  <Typography variant="body2">暂无项目，点击「新建项目」开始</Typography>
                </Box>
              ) : (
                <Grid container spacing={1.5}>
                  {recentProjects.map((project) => (
                    <Grid item xs={12} sm={6} key={project.id}>
                      <ProjectCard
                        project={project}
                        onOpen={(p) => {
                          onOpenProject(p);
                          navigate('/data');
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
