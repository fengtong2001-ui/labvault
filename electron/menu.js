'use strict';

/**
 * menu.js — 应用菜单构建器
 *
 * 构建原生菜单栏（文件 / 编辑 / 视图 / 帮助）并绑定到主窗口。
 * 通过 webContents.send() 将菜单事件发送给渲染进程。
 */

const { Menu, app, shell, dialog } = require('electron');

/**
 * 向渲染进程发送菜单命令
 * @param {BrowserWindow} win
 * @param {string} channel
 * @param {*} [payload]
 */
function sendToRenderer(win, channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

/**
 * 构建并设置应用菜单
 * @param {BrowserWindow} mainWindow
 */
function buildMenu(mainWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    // ── macOS 应用菜单（仅 macOS）────────────────────────────────────
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: `关于 ${app.name}` },
              { type: 'separator' },
              { role: 'services', label: '服务' },
              { type: 'separator' },
              { role: 'hide', label: `隐藏 ${app.name}` },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '显示全部' },
              { type: 'separator' },
              { role: 'quit', label: `退出 ${app.name}` },
            ],
          },
        ]
      : []),

    // ── 文件 ─────────────────────────────────────────────────────────
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer(mainWindow, 'menu:newProject'),
        },
        {
          label: '打开项目…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer(mainWindow, 'menu:openProject'),
        },
        { type: 'separator' },
        {
          label: '导入数据…',
          accelerator: 'CmdOrCtrl+I',
          click: () => sendToRenderer(mainWindow, 'menu:importData'),
        },
        {
          label: '导出报告…',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendToRenderer(mainWindow, 'menu:exportReport'),
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer(mainWindow, 'menu:save'),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' },
      ],
    },

    // ── 编辑 ─────────────────────────────────────────────────────────
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        {
          label: '查找…',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToRenderer(mainWindow, 'menu:find'),
        },
      ],
    },

    // ── 视图 ─────────────────────────────────────────────────────────
    {
      label: '视图',
      submenu: [
        {
          label: '仪表盘',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendToRenderer(mainWindow, 'menu:navigate', '/'),
        },
        {
          label: '项目管理',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendToRenderer(mainWindow, 'menu:navigate', '/projects'),
        },
        {
          label: '数据表格',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendToRenderer(mainWindow, 'menu:navigate', '/data'),
        },
        {
          label: '图表构建器',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendToRenderer(mainWindow, 'menu:navigate', '/charts'),
        },
        {
          label: '统计分析',
          accelerator: 'CmdOrCtrl+5',
          click: () => sendToRenderer(mainWindow, 'menu:navigate', '/statistics'),
        },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },

    // ── 窗口（仅 macOS）──────────────────────────────────────────────
    ...(isMac
      ? [
          {
            label: '窗口',
            submenu: [
              { role: 'minimize', label: '最小化' },
              { role: 'zoom', label: '缩放' },
              { type: 'separator' },
              { role: 'front', label: '全部移到前面' },
            ],
          },
        ]
      : []),

    // ── 帮助 ─────────────────────────────────────────────────────────
    {
      label: '帮助',
      submenu: [
        {
          label: '使用文档',
          click: () => shell.openExternal('https://github.com/labvault/labvault#readme'),
        },
        {
          label: '报告问题…',
          click: () => shell.openExternal('https://github.com/labvault/labvault/issues'),
        },
        { type: 'separator' },
        {
          label: '关于 LabVault',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 LabVault',
              message: 'LabVault 科研数据管理系统',
              detail: [
                `版本：${app.getVersion()}`,
                `Electron：${process.versions.electron}`,
                `Node.js：${process.versions.node}`,
                `平台：${process.platform} ${process.arch}`,
              ].join('\n'),
              buttons: ['确定'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildMenu };
