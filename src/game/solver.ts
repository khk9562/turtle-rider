import { dist, pointSegmentDist, segmentEnterRect, type Vec } from './geometry';
import { BASE_SPEED, preparePath, simulate, slopeFactor, type PathBox } from './sim';

export interface DetourInput {
  /** 출발 → 박스 → 골을 이은 기준 경로. 첫 점이 출발점이다 */
  reference: Vec[];
  boxes: PathBox[];
  goal: Vec;
  goalRadius: number;
  /** 가지 끝이 이 사각형(월드에서 여백을 뺀 영역) 안에 있어야 한다 */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** 맞추려는 도착 시간 */
  target: number;
}

const DIRECTIONS = 48;

/**
 * 기준 경로 앞에 "출발점에서 뻗었다가 되돌아오는 가지"를 붙여 목표 시간에 맞춘 해답 경로를 만든다.
 * 가지는 첫 박스를 밟기 전이라 효과가 없으므로, 늘어나는 시간이 가지 길이에 정비례한다.
 * 같은 시간을 가장 짧은 선으로 버는 방향(보통 위아래)을 고른다. 단계가 풀리는지 확인하고 잉크 양을 정할 때 쓴다
 */
export function detourSolution(input: DetourInput): Vec[] | null {
  const { reference, boxes, goal, goalRadius, bounds, target } = input;
  const start = reference[0];
  const refTime = simulate(preparePath(reference, boxes));
  const extra = target - refTime;
  if (extra <= 0) return reference;

  let best: { points: Vec[]; length: number } | null = null;
  for (let i = 0; i < DIRECTIONS; i++) {
    const a = (i / DIRECTIONS) * Math.PI * 2;
    const d = { x: Math.cos(a), y: Math.sin(a) };
    const reach = spikeReach(start, d, boxes, goal, goalRadius, bounds);
    if (reach < 4) continue;
    const tipFar = { x: start.x + d.x * reach, y: start.y + d.y * reach };
    // 가지 길이 1당 늘어나는 시간: 나갈 때와 돌아올 때 경사가 반대다
    const rate = 1 / (BASE_SPEED * slopeFactor(start, tipFar)) + 1 / (BASE_SPEED * slopeFactor(tipFar, start));
    const spikes = Math.ceil(extra / (rate * reach));
    const len = extra / (rate * spikes);
    const total = 2 * len * spikes;
    if (best && total >= best.length) continue;
    const tip = { x: start.x + d.x * len, y: start.y + d.y * len };
    const points: Vec[] = [start];
    for (let s = 0; s < spikes; s++) points.push(tip, start);
    points.push(...reference.slice(1));
    best = { points, length: total };
  }
  return best?.points ?? null;
}

/** 출발점에서 d 방향으로 박스와 골을 건드리지 않고 월드 안에서 뻗을 수 있는 최대 길이 */
function spikeReach(
  start: Vec,
  d: Vec,
  boxes: PathBox[],
  goal: Vec,
  goalRadius: number,
  bounds: DetourInput['bounds'],
): number {
  let hi = Infinity;
  if (d.x > 1e-9) hi = Math.min(hi, (bounds.maxX - start.x) / d.x);
  if (d.x < -1e-9) hi = Math.min(hi, (bounds.minX - start.x) / d.x);
  if (d.y > 1e-9) hi = Math.min(hi, (bounds.maxY - start.y) / d.y);
  if (d.y < -1e-9) hi = Math.min(hi, (bounds.minY - start.y) / d.y);
  if (!(hi > 0)) return 0;
  const ok = (len: number) => {
    const tip = { x: start.x + d.x * len, y: start.y + d.y * len };
    if (boxes.some((b) => segmentEnterRect(start, tip, b.rect) !== null)) return false;
    // 골에 가까이 가면 그리기가 골에 붙어 끝나 버린다
    return pointSegmentDist(goal, start, tip) > goalRadius + 4;
  };
  if (ok(hi)) return hi;
  let lo = 0;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function pathLength(points: Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}
