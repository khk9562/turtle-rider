import { clamp, dist, lerp, pointSegmentDist, type Vec } from './geometry';
import { GOAL_RADIUS, WORLD_H, WORLD_W, type Level } from './level';
import { preparePath, type PreparedPath } from './sim';
import { pathLength } from './solver';

/** 손가락 떨림을 거르는 최소 간격(월드 단위) */
export const MIN_STEP = 4;

/** 획마다 따로 저장해 되돌리기를 획 단위로 한다. 새 획은 직전 끝점에서 이어진다 */
export interface Drawing {
  strokes: Vec[][];
  finished: boolean;
}

export function emptyDrawing(): Drawing {
  return { strokes: [], finished: false };
}

export function pathPoints(level: Level, drawing: Drawing): Vec[] {
  return [level.start, ...drawing.strokes.flat()];
}

function lastPoint(level: Level, drawing: Drawing): Vec {
  for (let i = drawing.strokes.length - 1; i >= 0; i--) {
    const s = drawing.strokes[i];
    if (s.length) return s[s.length - 1];
  }
  return level.start;
}

export function clampToWorld(p: Vec): Vec {
  return { x: clamp(p.x, 4, WORLD_W - 4), y: clamp(p.y, 4, WORLD_H - 4) };
}

/** 지금까지 쓴 잉크. 출발점에서 첫 점까지, 획 사이를 잇는 직선도 포함한다 */
export function inkUsed(level: Level, drawing: Drawing): number {
  return pathLength(pathPoints(level, drawing));
}

/** 점을 더한다. 골 반경을 스치면 골에 붙이고 그리기를 끝낸다. 잉크가 모자라면 남은 만큼만 긋는다. 점이 늘었으면 true */
export function addPoint(level: Level, drawing: Drawing, raw: Vec): boolean {
  if (drawing.finished || drawing.strokes.length === 0) return false;
  const remaining = level.ink === null ? Infinity : level.ink - inkUsed(level, drawing);
  if (remaining < 0.5) return false;
  const p = clampToWorld(raw);
  const prev = lastPoint(level, drawing);
  const stroke = drawing.strokes[drawing.strokes.length - 1];
  if (stroke.length > 0 && dist(prev, p) < MIN_STEP) return false;
  if (pointSegmentDist(level.goal, prev, p) <= GOAL_RADIUS) {
    const toGoal = dist(prev, level.goal);
    if (toGoal <= remaining) {
      stroke.push({ ...level.goal });
      drawing.finished = true;
    } else {
      stroke.push(lerp(prev, level.goal, remaining / toGoal));
    }
    return true;
  }
  const d = dist(prev, p);
  stroke.push(d > remaining ? lerp(prev, p, remaining / d) : p);
  return true;
}

export function beginStroke(level: Level, drawing: Drawing, p: Vec): boolean {
  if (drawing.finished) return false;
  drawing.strokes.push([]);
  return addPoint(level, drawing, p);
}

export function endStroke(drawing: Drawing): void {
  const last = drawing.strokes[drawing.strokes.length - 1];
  if (last && last.length === 0) drawing.strokes.pop();
}

export function undoStroke(drawing: Drawing): void {
  drawing.strokes.pop();
  drawing.finished = false;
}

export interface DrawingStatus {
  path: PreparedPath;
  hit: boolean[];
  reachedGoal: boolean;
  /** 쓴 잉크(월드 단위) */
  ink: number;
  ready: boolean;
}

export function drawingStatus(level: Level, drawing: Drawing): DrawingStatus {
  const path = preparePath(pathPoints(level, drawing), level.boxes);
  const hit = level.boxes.map((_, i) => path.events.some((e) => e.box === i));
  const reachedGoal = drawing.finished;
  return { path, hit, reachedGoal, ink: path.length, ready: reachedGoal && hit.every(Boolean) };
}
