import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { lightTheme, darkTheme } from './theme';

// 组件
import Sidebar from './components/Sidebar';

// 页面
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import DataTable from './pages/DataTable';
import ChartBuilder from './pages/ChartBuilder';
import Statistics from './pages/Statistics';
import Export from './pages/Export';

const SIDEBAR_WIDTH = 220;

function App() {
  // 主题偏好持久化:刷新/重开不再回退浅色 —— zcode
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('labvault-theme') === 'dark'; } catch { return false; }
  });
  const [currentProject, setCurrentProject] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('labvault-theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box
          sx={{
            display: 'flex',
            height: '100vh',
            bgcolor: 'background.default',
            overflow: 'hidden',
          }}
        >
          {/* 左侧导航栏 */}
          <Sidebar
            width={SIDEBAR_WIDTH}
            isDark={isDark}
            onToggleTheme={() => setIsDark(!isDark)}
            currentProject={currentProject}
          />

          {/* 右侧内容区 — 普通 block 流:页面根的 mx:auto + maxWidth 才能正确撑满/居中
              (flex column 下交叉轴 auto margin 会取消 stretch,导致整页收缩,zcode 修复) */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              ml: `${SIDEBAR_WIDTH}px`,
              height: '100vh',
              overflow: 'auto',
            }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <Dashboard
                    onOpenProject={setCurrentProject}
                    currentProject={currentProject}
                  />
                }
              />
              <Route
                path="/projects"
                element={
                  <Projects
                    currentProject={currentProject}
                    onSelectProject={setCurrentProject}
                  />
                }
              />
              <Route
                path="/data"
                element={<DataTable currentProject={currentProject} isDark={isDark} />}
              />
              <Route
                path="/charts"
                element={<ChartBuilder currentProject={currentProject} isDark={isDark} />}
              />
              <Route
                path="/statistics"
                element={<Statistics currentProject={currentProject} isDark={isDark} />}
              />
              <Route
                path="/export"
                element={<Export currentProject={currentProject} isDark={isDark} />}
              />
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
