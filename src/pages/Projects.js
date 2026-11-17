import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActionArea,
  Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Chip, Stack, Skeleton, Alert, Menu,
  MenuItem, Tooltip, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { projectsApi } from '../utils/api';

function ProjectCard({ project, onOpen, onDelete }) {
  const [anchor, setAnchor] = useState(null);

  return (
    <Card sx={{ position: 'relative' }}>
      <CardActionArea onClick={() => onOpen(project)} sx={{ pr: 5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} noWrap gutterBottom>
            {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 36 }}>
            {project.description || '暂无描述'}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip
              label={project.status || '进行中'}
              size="small"
              color={project.status === '已完成' ? 'success' : 'primary'}
              variant="outlined"
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
              <AccessTimeIcon sx={{ fontSize: 13 }} />
              <Typography variant="caption">
                {project.updated_at
                  ? new Date(project.updated_at).toLocaleDateString('zh-CN')
                  : '未知'}
              </Typography>
            </Box>
            {project.dataset_count !== undefined && (
              <Typography variant="caption" color="text.secondary">
                {project.dataset_count} 数据集
              </Typography>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>

      {/* 更多操作按钮 */}
      <IconButton
        size="small"
        sx={{ position: 'absolute', top: 8, right: 8 }}
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { onOpen(project); setAnchor(null); }}>
          <FolderOpenIcon fontSize="small" sx={{ mr: 1 }} /> 打开项目
        </MenuItem>
        <MenuItem
          onClick={() => { onDelete(project); setAnchor(null); }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> 删除项目
        </MenuItem>
      </Menu>
    </Card>
  );
}

export default function Projects({ currentProject, onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', status: '进行中' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    projectsApi.list()
      .then((data) => setProjects(Array.isArray(data) ? data : data.data || data.projects || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const created = await projectsApi.create(form);
      setProjects((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm({ name: '', description: '', status: '进行中' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await projectsApi.delete(deleteTarget.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* 页头 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>项目管理</Typography>
          <Typography variant="body2" color="text.secondary">
            管理所有科研数据项目
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          新建项目
        </Button>
      </Box>

      {/* 搜索栏 */}
      <TextField
        fullWidth
        placeholder="搜索项目名称或描述…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3, maxWidth: 400 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* 项目网格 */}
      {loading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            color: 'text.disabled',
          }}
        >
          <FolderOpenIcon sx={{ fontSize: 60, mb: 2, opacity: 0.4 }} />
          <Typography variant="h6" gutterBottom>
            {search ? '未找到匹配的项目' : '暂无项目'}
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            {search ? '请尝试其他搜索词' : '点击「新建项目」创建您的第一个项目'}
          </Typography>
          {!search && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              新建项目
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <ProjectCard
                project={project}
                onOpen={onSelectProject}
                onDelete={setDeleteTarget}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 新建项目对话框 */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新建项目</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="项目名称"
              fullWidth
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例：胰岛素敏感性实验 2024"
            />
            <TextField
              label="项目描述"
              fullWidth
              multiline
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="简要描述实验目的和背景…"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.name.trim() || submitting}
          >
            {submitting ? '创建中…' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除项目 <strong>「{deleteTarget?.name}」</strong> 吗？此操作不可撤销。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
