export type BoxType = 'grass' | 'rabbit' | 'snail' | 'plane';

export interface BoxEffect {
  type: BoxType;
  name: string;
  /** 속도 배율 */
  mult: number;
  /** 효과 지속 시간(게임 초) */
  duration: number;
  /** 이 단계부터 등장 */
  fromLevel: number;
}

export const BOX_EFFECTS: Record<BoxType, BoxEffect> = {
  grass: { type: 'grass', name: '풀숲', mult: 1.4, duration: 1.5, fromLevel: 1 },
  rabbit: { type: 'rabbit', name: '토끼', mult: 2.0, duration: 2.0, fromLevel: 2 },
  snail: { type: 'snail', name: '달팽이', mult: 0.45, duration: 2.5, fromLevel: 3 },
  plane: { type: 'plane', name: '비행기', mult: 3.2, duration: 1.2, fromLevel: 5 },
};

export const BOX_TYPES = Object.keys(BOX_EFFECTS) as BoxType[];

export function boxTypesForLevel(level: number): BoxType[] {
  return BOX_TYPES.filter((t) => BOX_EFFECTS[t].fromLevel <= level);
}

export function describeEffect(type: BoxType): string {
  const e = BOX_EFFECTS[type];
  return `x${e.mult} ${e.duration}초`;
}
