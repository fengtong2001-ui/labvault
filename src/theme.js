import { createTheme } from '@mui/material/styles';

// LabVault 科研风格主题
// 灵感来自 GraphPad Prism 的专业、干净风格

const baseTypography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  h1: { fontWeight: 700, letterSpacing: '-0.02em' },
  h2: { fontWeight: 700, letterSpacing: '-0.01em' },
  h3: { fontWeight: 600, letterSpacing: '-0.01em' },
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  subtitle1: { fontWeight: 500 },
  subtitle2: { fontWeight: 500 },
  body1: { lineHeight: 1.6 },
  body2: { lineHeight: 1.5 },
  caption: { letterSpacing: '0.03em' },
  button: { fontWeight: 600, letterSpacing: '0.02em', textTransform: 'none' },
  overline: { fontWeight: 600, letterSpacing: '0.08em' },
  mono: { fontFamily: "'JetBrains Mono', 'Courier New', monospace" },
};

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1565C0',       // 深蓝 — 专业科研感
      light: '#1E88E5',
      dark: '#0D47A1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#00897B',       // 青绿 — 数据可视化强调色
      light: '#26A69A',
      dark: '#00695C',
      contrastText: '#ffffff',
    },
    error: {
      main: '#C62828',
      light: '#EF5350',
      dark: '#B71C1C',
    },
    warning: {
      main: '#E65100',
      light: '#FF7043',
      dark: '#BF360C',
    },
    success: {
      main: '#2E7D32',
      light: '#43A047',
      dark: '#1B5E20',
    },
    info: {
      main: '#01579B',
      light: '#0288D1',
      dark: '#014471',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
      sidebar: '#1A2332',
      sidebarHover: '#243040',
      tableHeader: '#EEF2F7',
    },
    text: {
      primary: '#1A2332',
      secondary: '#546E7A',
      disabled: '#B0BEC5',
    },
    divider: 'rgba(0,0,0,0.08)',
    chart: {
      blue:   '#1565C0',
      red:    '#C62828',
      green:  '#2E7D32',
      orange: '#E65100',
      purple: '#6A1B9A',
      teal:   '#00695C',
      pink:   '#AD1457',
      brown:  '#4E342E',
    },
  },
  typography: baseTypography,
  shape: { borderRadius: 6 },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.06)',
    '0 1px 4px rgba(0,0,0,0.08)',
    '0 2px 8px rgba(0,0,0,0.10)',
    '0 4px 12px rgba(0,0,0,0.12)',
    '0 6px 16px rgba(0,0,0,0.14)',
    '0 8px 24px rgba(0,0,0,0.16)',
    '0 12px 32px rgba(0,0,0,0.18)',
    '0 16px 40px rgba(0,0,0,0.20)',
    '0 20px 48px rgba(0,0,0,0.22)',
    '0 24px 56px rgba(0,0,0,0.24)',
    '0 28px 64px rgba(0,0,0,0.26)',
    '0 32px 72px rgba(0,0,0,0.28)',
    '0 36px 80px rgba(0,0,0,0.30)',
    '0 40px 88px rgba(0,0,0,0.32)',
    '0 44px 96px rgba(0,0,0,0.34)',
    '0 48px 104px rgba(0,0,0,0.36)',
    '0 52px 112px rgba(0,0,0,0.38)',
    '0 56px 120px rgba(0,0,0,0.40)',
    '0 60px 128px rgba(0,0,0,0.42)',
    '0 64px 136px rgba(0,0,0,0.44)',
    '0 68px 144px rgba(0,0,0,0.46)',
    '0 72px 152px rgba(0,0,0,0.48)',
    '0 76px 160px rgba(0,0,0,0.50)',
    '0 80px 168px rgba(0,0,0,0.52)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '7px 18px',
          fontSize: '0.875rem',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.06)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.78rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            backgroundColor: '#EEF2F7',
            color: '#546E7A',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.78rem',
          backgroundColor: '#1A2332',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#42A5F5',
      light: '#90CAF9',
      dark: '#1565C0',
      contrastText: '#000000',
    },
    secondary: {
      main: '#26A69A',
      light: '#80CBC4',
      dark: '#00796B',
      contrastText: '#000000',
    },
    error: { main: '#EF5350' },
    warning: { main: '#FF7043' },
    success: { main: '#66BB6A' },
    info: { main: '#29B6F6' },
    background: {
      default: '#0F1923',
      paper: '#1A2535',
      sidebar: '#111827',
      sidebarHover: '#1F2D3D',
      tableHeader: '#1E2D3D',
    },
    text: {
      primary: '#E8EDF2',
      secondary: '#90A4AE',
      disabled: '#455A64',
    },
    divider: 'rgba(255,255,255,0.08)',
    chart: {
      blue:   '#42A5F5',
      red:    '#EF5350',
      green:  '#66BB6A',
      orange: '#FF7043',
      purple: '#AB47BC',
      teal:   '#26A69A',
      pink:   '#F06292',
      brown:  '#A1887F',
    },
  },
  typography: baseTypography,
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 6, textTransform: 'none', fontWeight: 600 },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.78rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            backgroundColor: '#1E2D3D',
            color: '#90A4AE',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: '0.78rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
  },
});

export default lightTheme;
