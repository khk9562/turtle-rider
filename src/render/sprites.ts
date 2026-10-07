import type { BoxType } from '@/game/boxes';
import { pixelPalette } from '@/shared/theme';

/** 한 글자 = 한 픽셀. '.'은 투명. 색은 shared/theme.ts의 pixelPalette */
export type Sprite = readonly string[];

/** 오른쪽을 보는 거북이. 두 프레임은 다리만 다르다 */
const TURTLE_BODY = [
  '.....kkkkk......',
  '...kkGgGgGkk....',
  '..kGgGgGgGgGk...',
  '.kgGgGgGgGgGk.kk',
  '.kGgGgGgGgGgkssk',
  '.kgGgGgGgGgGksek',
  'kkkkkkkkkkkksssk',
  '.kyyyyyyyyyykkk.',
];

export const TURTLE_FRAMES: readonly Sprite[] = [
  [...TURTLE_BODY, '..kssk....kssk..', '..kkkk....kkkk..'],
  [...TURTLE_BODY, '...kssk..kssk...', '...kkkk..kkkk...'],
];

export const BOX_ICONS: Record<BoxType, Sprite> = {
  grass: [
    '..........',
    '..kk..kk..',
    '.kGgkkgGk.',
    '.kGggggGk.',
    '..kkgGkk..',
    '....kgk...',
    '....kgk...',
    '..kkkkkkk.',
    '..kbbbbbk.',
    '..kkkkkkk.',
  ],
  rabbit: [
    '..kk..kk..',
    '.kwpk.kpwk',
    '.kwpk.kpwk',
    '..kwwwwwk.',
    '.kwwwwwwwk',
    '.kwkwwwkwk',
    '.kwwwpwwwk',
    '..kwwwwwk.',
    '...kkkkk..',
    '..........',
  ],
  snail: [
    'k.k.......',
    'k.k..kkk..',
    'kyk.kbBbk.',
    'kyykbBkBbk',
    'kyykBkbkBk',
    'kyykbBBbBk',
    '.kyykbbbk.',
    '.kyyyyyyyk',
    '..kkkkkkk.',
    '..........',
  ],
  plane: [
    '..........',
    'kk...kk...',
    'kuk..kuk..',
    'kuukkkuukk',
    'kuuwuwuuuk',
    'kkuuuuuurk',
    '.kkkkuukk.',
    '....kuk...',
    '....kk....',
    '..........',
  ],
};

/** 체크무늬 결승 깃발 (무채색) */
export const GOAL_FLAG: Sprite = [
  'kkkkkkkkkk',
  'kwwkkwwkkk',
  'kwwkkwwkkk',
  'kkkwwkkwwk',
  'kkkwwkkwwk',
  'kkkkkkkkkk',
  'k.........',
  'k.........',
  'k.........',
  'kkk.......',
];

const cache = new Map<Sprite, HTMLCanvasElement>();

/** 스프라이트를 1픽셀 = 1px 캔버스로 한 번만 굽는다. 그릴 때는 smoothing을 끄고 늘린다 */
export function spriteCanvas(sprite: Sprite): HTMLCanvasElement {
  const hit = cache.get(sprite);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = sprite[0].length;
  c.height = sprite.length;
  const ctx = c.getContext('2d');
  if (ctx) {
    sprite.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = pixelPalette[row[x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  cache.set(sprite, c);
  return c;
}
