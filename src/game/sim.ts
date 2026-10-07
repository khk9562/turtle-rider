import { BOX_EFFECTS, type BoxType } from './boxes';
import { clamp, dist, lerp, segmentEnterRect, type Rect, type Vec } from './geometry';

/** 평지에서 거북이 기본 속도(월드 단위/초) */
export const BASE_SPEED = 55;
/** 경사 민감도: 내리막(+)은 빨라지고 오르막(-)은 느려진다 */
export const SLOPE_GAIN = 0.5;
export const MIN_SLOPE_FACTOR = 0.35;
export const MAX_SLOPE_FACTOR = 1.6;
/** 시뮬레이션 고정 간격. 화면 재생과 판정이 같은 값을 쓰므로 결과가 항상 같다 */
export const SIM_DT = 1 / 120;

export interface PathBox {
  type: BoxType;
  rect: Rect;
}

export interface BoxEvent {
  box: number;
  /** 경로 시작부터 박스에 처음 닿는 지점까지의 거리 */
  s: number;
}

export interface PreparedPath {
  points: Vec[];
  /** cum[i] = points[0]부터 points[i]까지 거리 */
  cum: number[];
  /** 선분 i(points[i]→points[i+1])의 경사 배율 */
  slope: number[];
  length: number;
  events: BoxEvent[];
  boxTypes: BoxType[];
}

/** 화면 좌표에서 y는 아래로 증가하므로 dy > 0 이 내리막이다 */
export function slopeFactor(a: Vec, b: Vec): number {
  const len = dist(a, b);
  if (len === 0) return 1;
  return clamp(1 + SLOPE_GAIN * ((b.y - a.y) / len), MIN_SLOPE_FACTOR, MAX_SLOPE_FACTOR);
}

/** boxes를 넘기지 않으면 박스 효과 없이 경사만 반영한다(일직선 미리보기용) */
export function preparePath(points: Vec[], boxes: PathBox[] = []): PreparedPath {
  const cum = [0];
  const slope: number[] = [];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
    slope.push(slopeFactor(points[i - 1], points[i]));
  }
  const events: BoxEvent[] = [];
  boxes.forEach((box, bi) => {
    for (let i = 1; i < points.length; i++) {
      const t = segmentEnterRect(points[i - 1], points[i], box.rect);
      if (t !== null) {
        events.push({ box: bi, s: cum[i - 1] + t * (cum[i] - cum[i - 1]) });
        return;
      }
    }
  });
  events.sort((a, b) => a.s - b.s);
  return { points, cum, slope, length: cum[cum.length - 1] ?? 0, events, boxTypes: boxes.map((b) => b.type) };
}

export interface ActiveEffect {
  type: BoxType;
  mult: number;
  until: number;
}

export interface RunState {
  t: number;
  s: number;
  seg: number;
  nextEvent: number;
  effect: ActiveEffect | null;
  done: boolean;
}

export function createRun(): RunState {
  return { t: 0, s: 0, seg: 0, nextEvent: 0, effect: null, done: false };
}

export function currentMult(state: RunState): number {
  return state.effect && state.t < state.effect.until ? state.effect.mult : 1;
}

export function currentSpeed(path: PreparedPath, state: RunState): number {
  const slope = path.slope[Math.min(state.seg, path.slope.length - 1)] ?? 1;
  return BASE_SPEED * slope * currentMult(state);
}

/** 고정 간격 한 번만큼 진행한다. 새로 밟은 박스 번호들을 돌려준다 */
export function stepRun(path: PreparedPath, state: RunState, dt = SIM_DT): number[] {
  if (state.done) return [];
  if (path.length === 0) {
    state.done = true;
    return [];
  }
  const v = currentSpeed(path, state);
  state.s += v * dt;
  state.t += dt;
  while (state.seg < path.slope.length - 1 && path.cum[state.seg + 1] <= state.s) state.seg++;

  const hits: number[] = [];
  while (state.nextEvent < path.events.length && path.events[state.nextEvent].s <= state.s) {
    const ev = path.events[state.nextEvent++];
    const type = path.boxTypes[ev.box];
    const e = BOX_EFFECTS[type];
    state.effect = { type, mult: e.mult, until: state.t + e.duration };
    hits.push(ev.box);
  }

  if (state.s >= path.length) {
    // 마지막 간격에서 넘친 거리만큼 시간을 되돌려 도착 시각을 정확히 맞춘다
    state.t -= (state.s - path.length) / v;
    state.s = path.length;
    state.done = true;
  }
  return hits;
}

/** 경로 끝까지 걸리는 게임 시간(초). cap을 넘기면 Infinity */
export function simulate(path: PreparedPath, cap = 300): number {
  const state = createRun();
  while (!state.done) {
    stepRun(path, state);
    if (state.t > cap) return Infinity;
  }
  return state.t;
}

export interface Pose {
  pos: Vec;
  angle: number;
  /** 진행 방향이 왼쪽이면 -1 */
  facing: 1 | -1;
}

export function poseAt(path: PreparedPath, s: number): Pose {
  const { points, cum } = path;
  if (points.length === 0) return { pos: { x: 0, y: 0 }, angle: 0, facing: 1 };
  if (points.length === 1) return { pos: points[0], angle: 0, facing: 1 };
  let i = 1;
  while (i < points.length - 1 && cum[i] < s) i++;
  const a = points[i - 1];
  const b = points[i];
  const segLen = cum[i] - cum[i - 1];
  const t = segLen === 0 ? 0 : clamp((s - cum[i - 1]) / segLen, 0, 1);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const facing: 1 | -1 = dx < 0 ? -1 : 1;
  // 스프라이트는 오른쪽을 보고 그려졌다. 왼쪽으로 갈 때는 좌우로 뒤집은 뒤 돌리므로 각도 부호가 바뀐다
  const angle = facing === 1 ? Math.atan2(dy, dx) : Math.atan2(dy, -dx) * -1;
  return { pos: lerp(a, b, t), angle: clamp(angle, -1.2, 1.2), facing };
}
