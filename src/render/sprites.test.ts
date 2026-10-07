import { describe, expect, it } from 'vitest';
import { pixelPalette } from '@/shared/theme';
import { BOX_ICONS, GOAL_FLAG, TURTLE_FRAMES, type Sprite } from './sprites';

const all: [string, Sprite][] = [
  ...TURTLE_FRAMES.map((f, i) => [`turtle${i}`, f] as [string, Sprite]),
  ...Object.entries(BOX_ICONS),
  ['goal', GOAL_FLAG],
];

describe('sprites', () => {
  it.each(all)('%s: 모든 줄 너비가 같고 팔레트에 있는 색만 쓴다', (_, sprite) => {
    const w = sprite[0].length;
    for (const row of sprite) {
      expect(row.length).toBe(w);
      for (const ch of row) if (ch !== '.') expect(pixelPalette[ch]).toBeDefined();
    }
  });
});
