import type { BoxType } from '@/game/boxes';

/** 모든 색의 원본. CSS는 applyTheme()이 넣어 주는 변수(--color-*, --accent-solid, --theme-line)만 쓴다 */
export const theme = {
  bg: '#f3efe2',
  surface: '#fffaf0',
  text: '#2f3a2c',
  muted: '#6d7565',
  line: '#d9d2bd',
  grid: '#e7e0cb',
  accent: '#3f8f5a',
  accentText: '#ffffff',
  danger: '#c9553d',
  success: '#3f8f5a',
  path: '#2f3a2c',
  pathPreview: '#3f8f5a',
  overlay: 'rgba(47, 58, 44, 0.45)',
} as const;

export const boxColors: Record<BoxType, { fill: string; edge: string }> = {
  grass: { fill: '#b8dc95', edge: '#5e9a45' },
  rabbit: { fill: '#f6d3de', edge: '#c9798f' },
  snail: { fill: '#eed4a6', edge: '#a87c3d' },
  plane: { fill: '#c4dcf5', edge: '#4f7fb5' },
};

/** 픽셀 스프라이트 팔레트 */
export const pixelPalette: Record<string, string> = {
  k: '#26301f',
  g: '#3f8f5a',
  G: '#6fbf73',
  s: '#a8d08d',
  y: '#e9d79a',
  e: '#111111',
  w: '#ffffff',
  p: '#f29bb3',
  b: '#9a6a32',
  B: '#d6a35f',
  u: '#5b8fd1',
  r: '#d9534f',
};

export function applyTheme(root: HTMLElement = document.documentElement): void {
  const vars: Record<string, string> = {
    '--color-bg': theme.bg,
    '--color-surface': theme.surface,
    '--color-text': theme.text,
    '--color-muted': theme.muted,
    '--color-danger': theme.danger,
    '--color-success': theme.success,
    '--color-overlay': theme.overlay,
    '--color-on-accent': theme.accentText,
    '--accent-solid': theme.accent,
    '--theme-line': theme.line,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
