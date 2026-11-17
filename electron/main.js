'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// ──────────────────────────────────────────────
// 环境判断
// ──────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ──────────────────────────────────────────────
// Python 后端进程句柄
// ──────────────────────────────────────────────
let pythonProcess = null;

/**
 * 启动 Python Flask 后端
 * 开发时从项目根目录启动；打包后从 resources/ 中启动
 */
function startPythonBackend() {
  const projectRoot = isDev
    ? path.join(__dirname, '..')
    : process.resourcesPath;

  const serverScript = path.join(projectRoot, 'backend', 'server.py');

  if (!fs.existsSync(serverScript)) {
    console.error('[main] Python server script not found:', serverScript);
    return;
  }

  console.log('[main] Starting Python backend:', serverScript);

  pythonProcess = spawn('python3', [serverScript], {
    cwd: projectRoot,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[python] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[python:err] ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[main] Python backend exited with code ${code}`);
    pythonProcess = null;
  });

  pythonProcess.on('error', (err) => {
    console.error('[main] Failed to start Python backend:', err.message);
  });
}

/**
 * 关闭 Python 后端进程
 */
function stopPythonBackend() {
  if (pythonProcess) {
    console.log('[main] Stopping Python backend...');
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
}

// ──────────────────────────────────────────────
// 主窗口
// ──────────────────────────────────────────────
let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'LabVault — 科研数据管理系统',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 安全：隔离渲染进程上下文
      nodeIntegration: false,   // 安全：渲染进程不直接用 Node
      sandbox: false,           // preload 需要访问 Node
    },
    show: false, // 等内容加载完再显示，避免闪屏
  });

  // 加载页面
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools(); // 开发模式打开 DevTools
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  }

  // 内容就绪后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 设置应用菜单
  const { buildMenu } = require('./menu');
  buildMenu(mainWindow);
}

// ──────────────────────────────────────────────
// IPC 处理：文件系统操作
// ──────────────────────────────────────────────

/**
 * 打开文件对话框
 * 参数：{ title, filters, multiSelections }
 * 返回：{ canceled, filePaths }
 */
ipcMain.handle('dialog:openFile', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || '打开文件',
    filters: options.filters || [
      { name: '数据文件', extensions: ['csv', 'xlsx', 'xls', 'txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: options.multiSelections
      ? ['openFile', 'multiSelections']
      : ['openFile'],
  });
  return result;
});

/**
 * 打开文件夹对话框
 * 返回：{ canceled, filePaths }
 */
ipcMain.handle('dialog:openDirectory', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || '选择文件夹',
    properties: ['openDirectory'],
  });
  return result;
});

/**
 * 保存文件对话框
 * 参数：{ title, defaultPath, filters }
 * 返回：{ canceled, filePath }
 */
ipcMain.handle('dialog:saveFile', async (_event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || '保存文件',
    defaultPath: options.defaultPath || 'labvault_export',
    filters: options.filters || [
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  return result;
});

/**
 * 读取文件内容（文本）
 * 参数：filePath
 * 返回：{ success, content, error }
 */
ipcMain.handle('fs:readFile', async (_event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 写入文件内容
 * 参数：{ filePath, content }
 * 返回：{ success, error }
 */
ipcMain.handle('fs:writeFile', async (_event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 获取应用路径
 * 参数：name ('home' | 'appData' | 'documents' | 'downloads' | 'userData')
 * 返回：path string
 */
ipcMain.handle('app:getPath', (_event, name) => {
  try {
    return app.getPath(name);
  } catch {
    return '';
  }
});

/**
 * 在系统文件管理器中显示文件
 */
ipcMain.handle('shell:showItemInFolder', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

/**
 * 用系统默认程序打开路径
 */
ipcMain.handle('shell:openPath', async (_event, filePath) => {
  const err = await shell.openPath(filePath);
  return { error: err || null };
});

// ──────────────────────────────────────────────
// 应用生命周期
// ──────────────────────────────────────────────
app.on('ready', () => {
  startPythonBackend();

  // 给 Python 一点时间启动（开发时 Flask 冷启动约 1s）
  setTimeout(createMainWindow, isDev ? 1500 : 500);
});

app.on('window-all-closed', () => {
  // macOS 惯例：关闭所有窗口不退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS：点击 Dock 图标时重新创建窗口
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on('will-quit', () => {
  stopPythonBackend();
});

// 未捕获的异常保证后端进程被清理
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err);
  stopPythonBackend();
});
