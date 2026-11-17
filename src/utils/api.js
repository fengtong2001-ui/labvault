import axios from 'axios';

// API 基础配置 — 对接 Flask 后端 (localhost:5050)
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5050';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可在此注入认证 token
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 — 统一错误处理
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      '网络请求失败';
    return Promise.reject(new Error(message));
  }
);

// ─────────────────────────────────────────────
// 项目管理 API
// ─────────────────────────────────────────────
export const projectsApi = {
  /** 获取所有项目列表 */
  list: () => api.get('/api/projects'),

  /** 创建新项目 */
  create: (data) => api.post('/api/projects', data),

  /** 获取单个项目详情 */
  get: (id) => api.get(`/api/projects/${id}`),

  /** 更新项目信息 */
  update: (id, data) => api.put(`/api/projects/${id}`, data),

  /** 删除项目 */
  delete: (id) => api.delete(`/api/projects/${id}`),
};

// ─────────────────────────────────────────────
// 数据集管理 API
// ─────────────────────────────────────────────
export const datasetsApi = {
  /** 获取项目下所有数据集 */
  list: (projectId) => api.get(`/api/projects/${projectId}/datasets`),

  /** 创建数据集 */
  create: (projectId, data) => api.post(`/api/projects/${projectId}/datasets`, data),

  /** 获取数据集详情（含数据）— 后端路由为 /api/datasets/<id> (zcode 修正) */
  get: (projectId, datasetId) =>
    api.get(`/api/datasets/${datasetId}`),

  /** 更新数据集内容 — 注意: 后端暂无 PUT 路由,见看板任务 (zcode) */
  update: (projectId, datasetId, data) =>
    api.put(`/api/datasets/${datasetId}`, data),

  /** 删除数据集 */
  delete: (projectId, datasetId) =>
    api.delete(`/api/datasets/${datasetId}`),
};

// ─────────────────────────────────────────────
// 数据导入 API
// ─────────────────────────────────────────────
export const importApi = {
  /**
   * 上传文件（CSV / Excel）
   * @param {File} file - 文件对象
   * @param {Object} options - 额外选项 { projectId, datasetName }
   */
  upload: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.projectId) formData.append('project_id', options.projectId);
    if (options.datasetName) formData.append('dataset_name', options.datasetName);
    return api.post('/api/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
};

// ─────────────────────────────────────────────
// 统计分析 API
// ─────────────────────────────────────────────
export const statsApi = {
  /** t 检验 */
  ttest: (data) => api.post('/api/stats/ttest', data),

  /** 方差分析 (ANOVA) */
  anova: (data) => api.post('/api/stats/anova', data),

  /** 非参数检验 */
  nonparam: (data) => api.post('/api/stats/nonparam', data),

  /** 回归分析 */
  regression: (data) => api.post('/api/stats/regression', data),

  /** 生存分析 */
  survival: (data) => api.post('/api/stats/survival', data),

  /** ROC 曲线分析 */
  roc: (data) => api.post('/api/stats/roc', data),

  /** IC50 / EC50 拟合 */
  ic50: (data) => api.post('/api/stats/ic50', data),
};

// ─────────────────────────────────────────────
// 图表生成 API
// ─────────────────────────────────────────────
export const chartsApi = {
  /**
   * 生成图表数据（返回 Plotly JSON）
   * @param {Object} config - { type, data, layout, style }
   */
  generate: (config) => api.post('/api/charts/generate', config),
};

// ─────────────────────────────────────────────
// 导出 API
// ─────────────────────────────────────────────
export const exportApi = {
  /**
   * 导出 PDF 报告
   * @param {Object} data - { projectId, sections, title }
   */
  pdf: async (data) => {
    const response = await axios.post(`${BASE_URL}/api/export/pdf`, data, {
      responseType: 'blob',
      timeout: 60000,
    });
    return response;
  },

  /**
   * 导出 SVG 图表
   * @param {Object} data - { chartData, format }
   */
  svg: async (data) => {
    const response = await axios.post(`${BASE_URL}/api/export/svg`, data, {
      responseType: 'blob',
      timeout: 30000,
    });
    return response;
  },

  /**
   * 导出 Excel 文件
   * @param {Object} data - { datasetId, projectId }
   */
  excel: async (data) => {
    const response = await axios.post(`${BASE_URL}/api/export/excel`, data, {
      responseType: 'blob',
      timeout: 30000,
    });
    return response;
  },
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 触发浏览器文件下载 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export default api;
