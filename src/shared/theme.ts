import type { BoxType } from '@/game/boxes';

/** 모든 색의 원본. CSS는 applyTheme()이 넣어 주는 변수(--color-*, --accent-solid, --theme-line)만 쓴다 */
export const theme = {
  bg: '#fefefe',
  surface: '#ffffff',
  text: '#1c1c1e',
  muted: '#8e8e93',
  faint: '#c7c7cc',
  line: '#e9e9ec',
  grid: '#ececef',
  accent: '#1c1c1e',
  accentText: '#fefefe',
  danger: '#d14b3f',
  success: '#2e9e4f',
  path: '#2a2a2d',
  pathPreview: '#b4b4ba',
  overlay: 'rgba(254, 254, 254, 0.72)',
  shadow: 'rgba(28, 28, 30, 0.08)',
} as const;

/** 화면에서 색이 있는 것은 박스와 거북이뿐이다 */
export const boxColors: Record<BoxType, { fill: string; edge: string }> = {
  grass: { fill: '#b5ec8a', edge: '#3e9f2f' },
  rabbit: { fill: '#ffc2d4', edge: '#e2557f' },
  snail: { fill: '#ffd894', edge: '#d98a17' },
  plane: { fill: '#aed8ff', edge: '#2f7fd8' },
};

/** 픽셀 스프라이트 팔레트 */
export const pixelPalette: Record<string, string> = {
  k: '#1c1c1e',
  g: '#2e9e4f',
  G: '#63cf72',
  s: '#a2dc7f',
  y: '#f3dc8c',
  e: '#000000',
  w: '#ffffff',
  p: '#ff8fb0',
  b: '#a8681c',
  B: '#f0aa45',
  u: '#4a95e8',
  r: '#e2554f',
  n: '#d1d1d6',
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
    '--color-faint': theme.faint,
    '--color-shadow': theme.shadow,
    '--color-on-accent': theme.accentText,
    '--accent-solid': theme.accent,
    '--theme-line': theme.line,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
