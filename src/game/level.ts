import { boxTypesForLevel, type BoxType } from './boxes';
import { clamp, dist, type Rect, type Vec } from './geometry';
import { preparePath, simulate, type PathBox } from './sim';
import { detourSolution, pathLength } from './solver';

export const WORLD_W = 360;
export const WORLD_H = 600;
export const BOX_W = 56;
export const BOX_H = 30;
export const GOAL_RADIUS = 18;
/** 이 단계부터 "몇 초 초과, 몇 초 이내" 구간 제약이 붙는다 */
export const RANGE_FROM_LEVEL = 4;
/** 여기까지는 구간이 1초까지 좁아지는 기존 곡선. 이후로는 0.5초까지 더 좁아진다 */
export const TIGHT_FROM_LEVEL = 15;
/** 이 단계부터 그릴 수 있는 선 길이(잉크)에 상한이 붙는다 */
export const INK_FROM_LEVEL = 25;
/** 마지막 단계 */
export const MAX_LEVEL = 50;

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
  /** 그릴 수 있는 선 길이(월드 단위). 출발점에서 이어지는 연결선도 포함한다. null이면 제한 없음 */
  ink: number | null;
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
  if (level >= 35) return 7;
  if (level >= 16) return 6;
  return Math.min(5, 1 + Math.floor(level / 2));
}

export function roundTenth(v: number): number {
  return Math.round(v * 10) / 10;
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
    // 달팽이와 낮잠은 한 판에 두 개까지만. 너무 많으면 기다리는 시간만 길어진다
    if ((t === 'snail' || t === 'nap') && types.filter((x) => x === t).length >= 2) t = 'grass';
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
  if (level < TIGHT_FROM_LEVEL) {
    const min = roundHalf(referenceTime * (1.15 + 0.02 * k));
    return { min, max: roundHalf(min + Math.max(1, 3 - 0.2 * k)) };
  }
  // 15단계부터: 하한 배율은 1.35에서 50단계 1.5까지 천천히, 구간 폭은 1.0초에서 0.5초까지 좁힌다.
  // 박스가 늘어 기준 시간 자체가 길어지므로 배율은 조금만 올린다
  const late = level - (TIGHT_FROM_LEVEL - 1);
  const min = roundHalf(referenceTime * (1.15 + 0.02 * k + (0.15 * late) / (MAX_LEVEL - TIGHT_FROM_LEVEL + 1)));
  const window = roundTenth(1 - (0.5 * (late - 1)) / (MAX_LEVEL - TIGHT_FROM_LEVEL));
  return { min, max: roundTenth(min + window) };
}

export function generateLevel(level: number): Level {
  const rand = mulberry32(level * 7919 + 17);
  const margin = 34;
  const mirror = level % 2 === 0;
  // 6단계부터는 가끔 골이 출발보다 높이 있어 오르막을 그려야 한다. 35단계부터는 더 자주
  const uphill = level >= 6 && rand() < (level >= 35 ? 0.4 : 0.3);

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

  const reference = referencePoints(start, goal, boxes);
  const referenceTime = simulate(preparePath(reference, boxes));
  const rule = ruleForLevel(level, referenceTime);
  let ink: number | null = null;
  if (level >= INK_FROM_LEVEL) {
    // 조건 구간 가운데에 맞춘 해답 경로 길이에 여유를 곱한다. 여유는 1.6배에서 50단계 1.3배까지 줄어든다
    const solution = solveRoute({ start, goal, boxes }, rule);
    const slack = 1.6 - (0.3 * (level - INK_FROM_LEVEL)) / (MAX_LEVEL - INK_FROM_LEVEL);
    ink = solution ? Math.ceil((pathLength(solution) * slack) / 10) * 10 : null;
  }
  return { number: level, start, goal, boxes, rule, ink, referenceTime };
}

/** 조건 구간 가운데 시간에 도착하는 해답 경로(출발점 포함). 단계가 풀리는지 확인하고 잉크 양을 정할 때 쓴다 */
export function solveRoute(level: Pick<Level, 'start' | 'goal' | 'boxes'>, rule: TimeRule): Vec[] | null {
  const target = rule.min === null ? rule.max - 0.5 : (rule.min + rule.max) / 2;
  const reference = referencePoints(level.start, level.goal, level.boxes);
  return detourSolution({
    reference,
    boxes: level.boxes,
    goal: level.goal,
    goalRadius: GOAL_RADIUS,
    bounds: { minX: 8, minY: 8, maxX: WORLD_W - 8, maxY: WORLD_H - 8 },
    target,
  });
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
