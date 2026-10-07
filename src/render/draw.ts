import { BOX_EFFECTS, type BoxType } from '@/game/boxes';
import type { Vec } from '@/game/geometry';
import { GOAL_RADIUS, WORLD_H, WORLD_W, type Level } from '@/game/level';
import type { Pose } from '@/game/sim';
import { boxColors, theme } from '@/shared/theme';
import { BOX_ICONS, GOAL_FLAG, TURTLE_FRAMES, spriteCanvas } from './sprites';

export interface View {
  scale: number;
  ox: number;
  oy: number;
  dpr: number;
}

/** 월드(360x600)를 캔버스 안에 비율을 지켜 가운데 맞춘다 */
export function fitView(cssW: number, cssH: number, dpr: number): View {
  const scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
  return { scale, ox: (cssW - WORLD_W * scale) / 2, oy: (cssH - WORLD_H * scale) / 2, dpr };
}

export function toWorld(view: View, cssX: number, cssY: number): Vec {
  return { x: (cssX - view.ox) / view.scale, y: (cssY - view.oy) / view.scale };
}

export interface Scene {
  level: Level;
  path: Vec[];
  hit: boolean[];
  /** 일직선 미리보기 중이면 점선 안내선을 그린다 */
  previewLine: boolean;
  turtle: { pose: Pose; frame: number; effect: BoxType | null } | null;
  /** 화면 위쪽 큰 숫자(진행 시간) */
  clock: string | null;
  caption: string | null;
}

const FONT = '"IBM Plex Sans KR", system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawSprite(ctx: CanvasRenderingContext2D, sprite: readonly string[], x: number, y: number, px: number) {
  const img = spriteCanvas(sprite);
  ctx.drawImage(img, x, y, img.width * px, img.height * px);
}

function drawBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = theme.surface;
  roundRect(ctx, 0.5, 0.5, WORLD_W - 1, WORLD_H - 1, 2);
  ctx.fill();
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = theme.grid;
  for (let x = 20; x < WORLD_W; x += 20) {
    for (let y = 20; y < WORLD_H; y += 20) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
  }
}

function drawBoxes(ctx: CanvasRenderingContext2D, level: Level, hit: boolean[]) {
  level.boxes.forEach((box, i) => {
    const { x, y, w, h } = box.rect;
    const c = boxColors[box.type];
    ctx.save();
    ctx.globalAlpha = hit[i] ? 1 : 0.85;
    ctx.fillStyle = c.fill;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.edge;
    if (!hit[i]) ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();

    const px = 2;
    drawSprite(ctx, BOX_ICONS[box.type], x + 4, y + (h - 10 * px) / 2, px);
    const e = BOX_EFFECTS[box.type];
    ctx.fillStyle = theme.text;
    ctx.font = `600 10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 아이콘 오른쪽 남은 칸 가운데에 배율을 쓴다
    ctx.fillText(`x${e.mult}`, (x + 4 + 10 * px + x + w) / 2, y + h / 2);
    if (hit[i]) {
      ctx.fillStyle = theme.text;
      ctx.beginPath();
      ctx.arc(x + w, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.accentText;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + w - 3, y);
      ctx.lineTo(x + w - 0.5, y + 2.5);
      ctx.lineTo(x + w + 3, y - 2.5);
      ctx.stroke();
    }
  });
}

function drawEnds(ctx: CanvasRenderingContext2D, level: Level) {
  const { start, goal } = level;
  ctx.fillStyle = theme.surface;
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = theme.muted;
  ctx.fillText('출발', start.x, start.y - 26);

  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = theme.faint;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, GOAL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawSprite(ctx, GOAL_FLAG, goal.x - 1, goal.y - 24, 2.2);
  ctx.fillStyle = theme.muted;
  ctx.fillText('골', goal.x, goal.y + GOAL_RADIUS + 14);
}

function drawPath(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = theme.path;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawPreviewLine(ctx: CanvasRenderingContext2D, level: Level) {
  ctx.save();
  ctx.setLineDash([2, 6]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = theme.pathPreview;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(level.start.x, level.start.y);
  ctx.lineTo(level.goal.x, level.goal.y);
  ctx.stroke();
  ctx.restore();
}

function drawTurtle(ctx: CanvasRenderingContext2D, t: NonNullable<Scene['turtle']>) {
  const { pose, frame, effect } = t;
  const px = 2;
  const img = spriteCanvas(TURTLE_FRAMES[frame % TURTLE_FRAMES.length]);
  ctx.save();
  ctx.translate(pose.pos.x, pose.pos.y);
  ctx.rotate(pose.angle);
  ctx.scale(pose.facing, 1);
  if (effect) {
    // 효과 중에는 뒤쪽에 속도선(빠름) 또는 물결(느림)을 그린다
    const fast = BOX_EFFECTS[effect].mult > 1;
    ctx.strokeStyle = boxColors[effect].edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const yy = -16 + i * 5;
      ctx.moveTo(-20 - (fast ? 10 : 4), yy);
      ctx.lineTo(-20, yy);
    }
    ctx.stroke();
  }
  ctx.drawImage(img, (-img.width * px) / 2, -img.height * px, img.width * px, img.height * px);
  ctx.restore();

  if (effect) drawSprite(ctx, BOX_ICONS[effect], pose.pos.x - 8, pose.pos.y - 42, 1.6);
}

export function drawScene(ctx: CanvasRenderingContext2D, view: View, cssW: number, cssH: number, scene: Scene): void {
  const { dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy);
  ctx.imageSmoothingEnabled = false;

  drawBoard(ctx);
  if (scene.previewLine) drawPreviewLine(ctx, scene.level);
  drawBoxes(ctx, scene.level, scene.hit);
  drawPath(ctx, scene.path);
  drawEnds(ctx, scene.level);
  if (scene.turtle) drawTurtle(ctx, scene.turtle);

  if (scene.clock) {
    ctx.font = `600 26px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 6;
    ctx.strokeStyle = theme.surface;
    ctx.strokeText(scene.clock, WORLD_W / 2, 12);
    ctx.fillStyle = theme.text;
    ctx.fillText(scene.clock, WORLD_W / 2, 12);
  }
  if (scene.caption) {
    ctx.font = `500 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = theme.muted;
    ctx.fillText(scene.caption, WORLD_W / 2, 44);
  }
}
