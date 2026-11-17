import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Paper,
  Chip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const ACCEPTED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DataImport({
  onFiles,
  files = [],
  uploading = false,
  uploadProgress = {},
  onRemoveFile,
  maxFiles = 5,
  disabled = false,
}) {
  const onDrop = useCallback(
    (accepted) => {
      if (onFiles) onFiles(accepted);
    },
    [onFiles]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled,
  });

  return (
    <Box>
      {/* 拖放区域 */}
      <Paper
        {...getRootProps()}
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isDragActive
            ? 'primary.main'
            : isDragReject
            ? 'error.main'
            : 'divider',
          bgcolor: isDragActive
            ? 'rgba(21,101,192,0.04)'
            : isDragReject
            ? 'rgba(198,40,40,0.04)'
            : 'background.paper',
          transition: 'all 0.2s',
          '&:hover': disabled
            ? {}
            : {
                borderColor: 'primary.main',
                bgcolor: 'rgba(21,101,192,0.03)',
              },
        }}
      >
        <input {...getInputProps()} />
        <UploadFileIcon
          sx={{
            fontSize: 48,
            color: isDragActive ? 'primary.main' : 'text.disabled',
            mb: 1.5,
            transition: 'color 0.2s',
          }}
        />
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {isDragActive
            ? '松开以导入文件'
            : isDragReject
            ? '不支持的文件格式'
            : '拖放文件到此处'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          或{' '}
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            点击选择文件
          </Box>
        </Typography>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1, justifyContent: 'center' }}>
          {['CSV', 'Excel (.xlsx)', 'XLS'].map((fmt) => (
            <Chip key={fmt} label={fmt} size="small" variant="outlined" sx={{ fontSize: '0.72rem' }} />
          ))}
        </Box>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
          最大文件大小 50 MB，最多 {maxFiles} 个文件
        </Typography>
      </Paper>

      {/* 文件列表 */}
      {files.length > 0 && (
        <List dense sx={{ mt: 2 }}>
          {files.map((file, idx) => {
            const progress = uploadProgress[file.name];
            const isDone = progress === 100;
            const isError = progress === -1;

            return (
              <ListItem
                key={`${file.name}-${idx}`}
                sx={{
                  border: '1px solid',
                  borderColor: isDone
                    ? 'success.light'
                    : isError
                    ? 'error.light'
                    : 'divider',
                  borderRadius: 1.5,
                  mb: 1,
                  bgcolor: 'background.paper',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  px: 2,
                  py: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <InsertDriveFileIcon
                      sx={{ color: isDone ? 'success.main' : 'primary.main' }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={formatFileSize(file.size)}
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  {isDone && (
                    <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} fontSize="small" />
                  )}
                  {isError && (
                    <ErrorIcon sx={{ color: 'error.main', mr: 1 }} fontSize="small" />
                  )}
                  {!uploading && (
                    <IconButton
                      size="small"
                      onClick={() => onRemoveFile && onRemoveFile(idx)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                {/* 上传进度条 */}
                {progress !== undefined && !isDone && !isError && (
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ mt: 0.5, borderRadius: 1 }}
                  />
                )}
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}
