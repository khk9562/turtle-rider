import { describe, expect, it } from 'vitest';
import { BOX_EFFECTS } from './boxes';
import { addPoint, beginStroke, drawingStatus, emptyDrawing, endStroke, undoStroke } from './drawing';
import { segmentEnterRect } from './geometry';
import {
  RANGE_FROM_LEVEL,
  WORLD_H,
  WORLD_W,
  generateLevel,
  judge,
  referencePoints,
  straightLineTime,
} from './level';
import { BASE_SPEED, MAX_SLOPE_FACTOR, MIN_SLOPE_FACTOR, preparePath, simulate, slopeFactor } from './sim';

describe('geometry', () => {
  it('선분이 사각형에 들어가는 비율을 구한다', () => {
    const r = { x: 10, y: -5, w: 10, h: 10 };
    expect(segmentEnterRect({ x: 0, y: 0 }, { x: 40, y: 0 }, r)).toBeCloseTo(0.25);
    expect(segmentEnterRect({ x: 0, y: 20 }, { x: 40, y: 20 }, r)).toBeNull();
    expect(segmentEnterRect({ x: 15, y: 0 }, { x: 40, y: 0 }, r)).toBe(0);
  });
});

describe('sim', () => {
  it('평지 직선은 거리 / 기본 속도만큼 걸린다', () => {
    const t = simulate(preparePath([{ x: 0, y: 100 }, { x: 220, y: 100 }]));
    expect(t).toBeCloseTo(220 / BASE_SPEED, 2);
  });

  it('내리막은 빠르고 오르막은 느리다', () => {
    expect(slopeFactor({ x: 0, y: 0 }, { x: 10, y: 10 })).toBeGreaterThan(1);
    expect(slopeFactor({ x: 0, y: 10 }, { x: 10, y: 0 })).toBeLessThan(1);
    expect(slopeFactor({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeLessThanOrEqual(MAX_SLOPE_FACTOR);
    expect(slopeFactor({ x: 0, y: 10 }, { x: 0, y: 0 })).toBeGreaterThanOrEqual(MIN_SLOPE_FACTOR);
  });

  it('토끼 박스는 시간을 줄이고 달팽이 박스는 늘린다', () => {
    const pts = [{ x: 0, y: 100 }, { x: 400, y: 100 }];
    const rect = { x: 50, y: 90, w: 20, h: 20 };
    const base = simulate(preparePath(pts));
    const rabbit = simulate(preparePath(pts, [{ type: 'rabbit', rect }]));
    const snail = simulate(preparePath(pts, [{ type: 'snail', rect }]));
    expect(rabbit).toBeLessThan(base);
    expect(snail).toBeGreaterThan(base);
    // 토끼 효과 2초 동안 2배속 → 정확히 2초 * 기본속도만큼 거리를 더 가므로 2초 단축
    const e = BOX_EFFECTS.rabbit;
    expect(base - rabbit).toBeCloseTo(e.duration * (e.mult - 1), 1);
  });

  it('같은 경로는 항상 같은 시간이 나온다', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 80 }, { x: 200, y: 20 }];
    expect(simulate(preparePath(pts))).toBe(simulate(preparePath(pts)));
  });
});

describe('level', () => {
  it('같은 단계는 같은 맵을 만든다', () => {
    expect(generateLevel(7)).toEqual(generateLevel(7));
  });

  it('모든 단계가 월드 안에 있고 박스가 겹치지 않는다', () => {
    for (let n = 1; n <= 40; n++) {
      const lv = generateLevel(n);
      expect(lv.boxes.length).toBeGreaterThan(0);
      for (const b of lv.boxes) {
        expect(b.rect.x).toBeGreaterThanOrEqual(0);
        expect(b.rect.y).toBeGreaterThanOrEqual(0);
        expect(b.rect.x + b.rect.w).toBeLessThanOrEqual(WORLD_W);
        expect(b.rect.y + b.rect.h).toBeLessThanOrEqual(WORLD_H);
      }
    }
  });

  it('기준 경로로는 초반 단계를 통과할 수 있다', () => {
    for (let n = 1; n < RANGE_FROM_LEVEL; n++) {
      const lv = generateLevel(n);
      expect(judge(lv.rule, lv.referenceTime)).toBe('success');
    }
  });

  it('구간 단계는 기준 경로가 너무 빨라서 일부러 돌아가야 한다', () => {
    for (let n = RANGE_FROM_LEVEL; n <= 30; n++) {
      const lv = generateLevel(n);
      expect(lv.rule.min).not.toBeNull();
      expect(lv.rule.max - (lv.rule.min ?? 0)).toBeGreaterThanOrEqual(1);
      expect(judge(lv.rule, lv.referenceTime)).toBe('too-fast');
    }
  });

  it('일직선 미리보기 시간은 양수다', () => {
    expect(straightLineTime(generateLevel(1))).toBeGreaterThan(0);
  });

  it('구간 판정: 초과는 미포함, 이내는 포함', () => {
    const rule = { min: 5, max: 7 };
    expect(judge(rule, 5)).toBe('too-fast');
    expect(judge(rule, 5.01)).toBe('success');
    expect(judge(rule, 7)).toBe('success');
    expect(judge(rule, 7.01)).toBe('too-slow');
  });
});

describe('drawing', () => {
  it('박스를 모두 지나 골에 닿아야 출발할 수 있다', () => {
    const lv = generateLevel(3);
    const d = emptyDrawing();
    const pts = referencePoints(lv.start, lv.goal, lv.boxes).slice(1);
    beginStroke(lv, d, pts[0]);
    for (const p of pts.slice(1)) addPoint(lv, d, p);
    endStroke(d);
    const st = drawingStatus(lv, d);
    expect(st.reachedGoal).toBe(true);
    expect(st.ready).toBe(true);

    undoStroke(d);
    expect(drawingStatus(lv, d).ready).toBe(false);
  });

  it('박스를 빼먹으면 골에 닿아도 출발할 수 없다', () => {
    let missed = 0;
    for (let n = 1; n <= 10; n++) {
      const lv = generateLevel(n);
      const d = emptyDrawing();
      beginStroke(lv, d, lv.goal);
      const st = drawingStatus(lv, d);
      expect(st.reachedGoal).toBe(true);
      expect(st.ready).toBe(st.hit.every(Boolean));
      if (!st.ready) missed++;
    }
    // 일직선으로는 대부분 박스를 놓친다
    expect(missed).toBeGreaterThan(5);
  });

  it('빠르게 그어도 골을 스치면 골에 붙는다', () => {
    const lv = generateLevel(1);
    const d = emptyDrawing();
    const far = { x: lv.goal.x + (lv.goal.x - lv.start.x), y: lv.goal.y + (lv.goal.y - lv.start.y) };
    beginStroke(lv, d, far);
    expect(d.finished).toBe(true);
    expect(d.strokes[0][0]).toEqual(lv.goal);
  });
});
