'use strict';

/**
 * preload.js — Electron 预加载脚本
 *
 * 在渲染进程中运行，但拥有 Node.js 访问权。
 * 通过 contextBridge 安全地将受限 API 暴露给页面（window.labvault）。
 * 不暴露完整的 Node / ipcRenderer，只暴露白名单方法。
 */

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');

// ──────────────────────────────────────────────
// 白名单：允许渲染进程调用的频道
// ──────────────────────────────────────────────
const INVOKE_WHITELIST = new Set([
  'dialog:openFile',
  'dialog:openDirectory',
  'dialog:saveFile',
  'fs:readFile',
  'fs:writeFile',
  'app:getPath',
  'shell:showItemInFolder',
  'shell:openPath',
]);

/**
 * 安全的 invoke 包装：只允许白名单频道
 */
function safeInvoke(channel, ...args) {
  if (!INVOKE_WHITELIST.has(channel)) {
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

// ──────────────────────────────────────────────
// 暴露给渲染进程的 API：window.labvault
// ──────────────────────────────────────────────
contextBridge.exposeInMainWorld('labvault', {
  // ── 系统信息 ──────────────────────────────
  system: {
    platform: process.platform,           // 'darwin' | 'win32' | 'linux'
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    hostname: os.hostname(),
  },

  // ── 文件对话框 ────────────────────────────
  /**
   * 打开文件选择对话框
   * @param {object} options - { title, filters, multiSelections }
   * @returns {Promise<{ canceled: boolean, filePaths: string[] }>}
   */
  openFile: (options) => safeInvoke('dialog:openFile', options),

  /**
   * 打开文件夹选择对话框
   * @param {object} options - { title }
   * @returns {Promise<{ canceled: boolean, filePaths: string[] }>}
   */
  openDirectory: (options) => safeInvoke('dialog:openDirectory', options),

  /**
   * 打开保存文件对话框
   * @param {object} options - { title, defaultPath, filters }
   * @returns {Promise<{ canceled: boolean, filePath: string }>}
   */
  saveFile: (options) => safeInvoke('dialog:saveFile', options),

  // ── 文件系统操作 ──────────────────────────
  /**
   * 读取本地文件（UTF-8 文本）
   * @param {string} filePath
   * @returns {Promise<{ success: boolean, content?: string, error?: string }>}
   */
  readFile: (filePath) => safeInvoke('fs:readFile', filePath),

  /**
   * 写入本地文件
   * @param {string} filePath
   * @param {string} content
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  writeFile: (filePath, content) =>
    safeInvoke('fs:writeFile', { filePath, content }),

  // ── 应用路径 ──────────────────────────────
  /**
   * 获取特定应用目录的路径
   * @param {'home'|'appData'|'documents'|'downloads'|'userData'} name
   * @returns {Promise<string>}
   */
  getPath: (name) => safeInvoke('app:getPath', name),

  // ── Shell 操作 ────────────────────────────
  /**
   * 在系统文件管理器中显示文件
   * @param {string} filePath
   */
  showInFolder: (filePath) =>
    safeInvoke('shell:showItemInFolder', filePath),

  /**
   * 用系统默认程序打开文件/URL
   * @param {string} target
   * @returns {Promise<{ error: string|null }>}
   */
  openExternal: (target) => safeInvoke('shell:openPath', target),

  // ── 路径工具（纯前端，无需 IPC）────────────
  path: {
    basename: (p, ext) => path.basename(p, ext),
    dirname: (p) => path.dirname(p),
    extname: (p) => path.extname(p),
    join: (...parts) => path.join(...parts),
  },
});
