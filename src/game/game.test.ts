import { describe, expect, it } from 'vitest';
import { BOX_EFFECTS } from './boxes';
import { addPoint, beginStroke, drawingStatus, emptyDrawing, endStroke, inkUsed, undoStroke } from './drawing';
import { segmentEnterRect } from './geometry';
import {
  INK_FROM_LEVEL,
  MAX_LEVEL,
  RANGE_FROM_LEVEL,
  TIGHT_FROM_LEVEL,
  WORLD_H,
  WORLD_W,
  boxCountForLevel,
  generateLevel,
  judge,
  referencePoints,
  solveRoute,
  straightLineTime,
  type Level,
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
    // 낮잠은 그 자리에서 1초 멈춘다
    const nap = simulate(preparePath(pts, [{ type: 'nap', rect }]));
    expect(nap - base).toBeCloseTo(BOX_EFFECTS.nap.duration, 1);
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

  it('모든 단계가 월드 안에 있고 정해진 수만큼 박스가 놓인다', () => {
    for (let n = 1; n <= MAX_LEVEL; n++) {
      const lv = generateLevel(n);
      expect(lv.boxes.length).toBe(boxCountForLevel(n));
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
    for (let n = RANGE_FROM_LEVEL; n <= MAX_LEVEL; n++) {
      const lv = generateLevel(n);
      expect(lv.rule.min).not.toBeNull();
      expect(lv.rule.max - (lv.rule.min ?? 0)).toBeGreaterThanOrEqual(n < TIGHT_FROM_LEVEL ? 1 : 0.5 - 1e-9);
      expect(judge(lv.rule, lv.referenceTime)).toBe('too-fast');
    }
  });

  it('구간 폭은 단계가 오를수록 좁아지고 50단계에서 0.5초가 된다', () => {
    const width = (n: number) => {
      const { min, max } = generateLevel(n).rule;
      return Math.round((max - (min ?? 0)) * 10) / 10;
    };
    for (let n = RANGE_FROM_LEVEL + 1; n <= MAX_LEVEL; n++) expect(width(n)).toBeLessThanOrEqual(width(n - 1));
    expect(width(TIGHT_FROM_LEVEL)).toBe(1);
    expect(width(MAX_LEVEL)).toBe(0.5);
  });

  it('잉크 제한은 정해진 단계부터 붙는다', () => {
    for (let n = 1; n <= MAX_LEVEL; n++) {
      const lv = generateLevel(n);
      if (n < INK_FROM_LEVEL) expect(lv.ink).toBeNull();
      else expect(lv.ink).toBeGreaterThan(0);
    }
  });

  it('모든 단계는 그리기로 실제 성공할 수 있다(잉크 포함)', () => {
    for (let n = 1; n <= MAX_LEVEL; n++) {
      const lv = generateLevel(n);
      const route = solveRoute(lv, lv.rule);
      expect(route, `${n}단계 해답`).not.toBeNull();
      const d = drawRoute(lv, route!);
      const st = drawingStatus(lv, d);
      expect(st.ready, `${n}단계 출발 가능`).toBe(true);
      expect(judge(lv.rule, simulate(st.path)), `${n}단계 판정`).toBe('success');
      if (lv.ink !== null) expect(st.ink).toBeLessThanOrEqual(lv.ink);
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

function drawRoute(lv: Level, route: { x: number; y: number }[]) {
  const d = emptyDrawing();
  beginStroke(lv, d, route[1]);
  for (const p of route.slice(2)) addPoint(lv, d, p);
  endStroke(d);
  return d;
}

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

  it('잉크가 다 떨어지면 더 그려지지 않는다', () => {
    const lv = { ...generateLevel(1), ink: 100 };
    const d = emptyDrawing();
    const away = { x: lv.start.x, y: lv.start.y > WORLD_H / 2 ? lv.start.y - 300 : lv.start.y + 300 };
    beginStroke(lv, d, away);
    expect(inkUsed(lv, d)).toBeCloseTo(100, 5);
    expect(addPoint(lv, d, lv.start)).toBe(false);
    expect(d.finished).toBe(false);
  });
});
