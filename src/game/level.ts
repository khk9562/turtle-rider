import { boxTypesForLevel, type BoxType } from './boxes';
import { clamp, dist, type Rect, type Vec } from './geometry';
import { preparePath, simulate, type PathBox } from './sim';

export const WORLD_W = 360;
export const WORLD_H = 600;
export const BOX_W = 56;
export const BOX_H = 30;
export const GOAL_RADIUS = 18;
/** 이 단계부터 "몇 초 초과, 몇 초 이내" 구간 제약이 붙는다 */
export const RANGE_FROM_LEVEL = 4;

export interface TimeRule {
  /** 이 시간보다 늦게 도착해야 한다(초과). 없으면 하한 없음 */
  min: number | null;
  /** 이 시간 안에 도착해야 한다(이내) */
  max: number;
}

export interface Level {
  number: number;
  start: Vec;
  goal: Vec;
  boxes: PathBox[];
  rule: TimeRule;
  /** 박스 중심을 일직선으로 이은 기준 경로의 소요 시간. 제약을 만들 때 쓴다 */
  referenceTime: number;
}

/** 단계 번호마다 항상 같은 맵이 나오도록 시드 난수를 쓴다 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundHalf(v: number): number {
  return Math.round(v * 2) / 2;
}

export function boxCountForLevel(level: number): number {
  return Math.min(5, 1 + Math.floor(level / 2));
}

export function boxCenter(r: Rect): Vec {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function rectsOverlap(a: Rect, b: Rect, pad: number): boolean {
  return a.x - pad < b.x + b.w && b.x - pad < a.x + a.w && a.y - pad < b.y + b.h && b.y - pad < a.y + a.h;
}

function pickTypes(level: number, count: number, rand: () => number): BoxType[] {
  const pool = boxTypesForLevel(level);
  const types: BoxType[] = [];
  // 새로 열린 박스는 그 단계에서 꼭 한 번 보여 준다
  const newest = pool[pool.length - 1];
  for (let i = 0; i < count; i++) {
    let t = pool[Math.floor(rand() * pool.length)];
    // 달팽이는 한 판에 두 개까지만. 너무 많으면 기다리는 시간만 길어진다
    if (t === 'snail' && types.filter((x) => x === 'snail').length >= 2) t = 'grass';
    types.push(t);
  }
  if (!types.includes(newest)) types[Math.floor(rand() * count)] = newest;
  return types;
}

/** 박스 중심을 출발→골 방향으로 정렬해 이은 기준 경로 */
export function referencePoints(start: Vec, goal: Vec, boxes: PathBox[]): Vec[] {
  const dx = goal.x - start.x;
  const dy = goal.y - start.y;
  const centers = boxes.map((b) => boxCenter(b.rect));
  centers.sort((a, b) => (a.x - start.x) * dx + (a.y - start.y) * dy - ((b.x - start.x) * dx + (b.y - start.y) * dy));
  return [start, ...centers, goal];
}

export function ruleForLevel(level: number, referenceTime: number): TimeRule {
  if (level < RANGE_FROM_LEVEL) {
    // 초반에는 넉넉한 상한만 둔다. 단계가 오를수록 여유가 줄어든다
    const slack = 1.45 - 0.05 * (level - 1);
    return { min: null, max: roundHalf(referenceTime * slack + 0.25) };
  }
  // 하한을 기준 시간보다 높게 잡아, 일부러 길게 돌거나 굴곡지게 그려야 맞출 수 있게 한다
  const k = Math.min(level - RANGE_FROM_LEVEL, 10);
  const min = roundHalf(referenceTime * (1.15 + 0.02 * k));
  const window = Math.max(1, 3 - 0.2 * k);
  return { min, max: roundHalf(min + window) };
}

export function generateLevel(level: number): Level {
  const rand = mulberry32(level * 7919 + 17);
  const margin = 34;
  const mirror = level % 2 === 0;
  // 6단계부터는 가끔 골이 출발보다 높이 있어 오르막을 그려야 한다
  const uphill = level >= 6 && rand() < 0.3;

  let start: Vec = { x: 40 + rand() * 70, y: 60 + rand() * 90 };
  let goal: Vec = { x: 250 + rand() * 75, y: WORLD_H - 170 + rand() * 110 };
  if (uphill) [start, goal] = [{ x: start.x, y: goal.y }, { x: goal.x, y: start.y }];
  if (mirror) {
    start = { x: WORLD_W - start.x, y: start.y };
    goal = { x: WORLD_W - goal.x, y: goal.y };
  }

  const count = boxCountForLevel(level);
  const types = pickTypes(level, count, rand);
  const boxes: PathBox[] = [];
  const dx = goal.x - start.x;
  const dy = goal.y - start.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i < count; i++) {
    let rect: Rect | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const t = (i + 1) / (count + 1) + (rand() - 0.5) * 0.12;
      const side = rand() < 0.5 ? -1 : 1;
      const off = side * (30 + rand() * (60 + level * 4));
      const cx = clamp(start.x + dx * t + nx * off, margin + BOX_W / 2, WORLD_W - margin - BOX_W / 2);
      const cy = clamp(start.y + dy * t + ny * off, margin + BOX_H / 2, WORLD_H - margin - BOX_H / 2);
      const candidate = { x: cx - BOX_W / 2, y: cy - BOX_H / 2, w: BOX_W, h: BOX_H };
      const c = boxCenter(candidate);
      const clear =
        dist(c, start) > 60 && dist(c, goal) > 60 && boxes.every((b) => !rectsOverlap(b.rect, candidate, 18));
      if (clear) {
        rect = candidate;
        break;
      }
    }
    if (rect) boxes.push({ type: types[i], rect });
  }

  const referenceTime = simulate(preparePath(referencePoints(start, goal, boxes), boxes));
  return { number: level, start, goal, boxes, rule: ruleForLevel(level, referenceTime), referenceTime };
}

/** 일직선(출발→골), 박스 효과 없이 걸리는 시간 */
export function straightLineTime(level: Level): number {
  return simulate(preparePath([level.start, level.goal]));
}

export function judge(rule: TimeRule, time: number): 'success' | 'too-slow' | 'too-fast' {
  if (time > rule.max) return 'too-slow';
  if (rule.min !== null && time <= rule.min) return 'too-fast';
  return 'success';
}

export function describeRule(rule: TimeRule): string {
  return rule.min === null ? `${rule.max.toFixed(1)}초 이내` : `${rule.min.toFixed(1)}초 초과 ~ ${rule.max.toFixed(1)}초 이내`;
}
