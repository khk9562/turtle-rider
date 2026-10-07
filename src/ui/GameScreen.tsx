import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOX_EFFECTS, type BoxType } from '@/game/boxes';
import {
  addPoint,
  beginStroke,
  drawingStatus,
  emptyDrawing,
  endStroke,
  pathPoints,
  undoStroke,
  type Drawing,
  type DrawingStatus,
} from '@/game/drawing';
import { describeRule, generateLevel, judge, straightLineTime, type Level } from '@/game/level';
import {
  SIM_DT,
  createRun,
  poseAt,
  preparePath,
  simulate,
  stepRun,
  type PreparedPath,
  type RunState,
} from '@/game/sim';
import { drawScene, fitView, toWorld, type Scene, type View } from '@/render/draw';
import { BOX_ICONS, spriteCanvas } from '@/render/sprites';
import { loadProgress, recordClear, saveProgress, type Progress } from '@/shared/storage';
import styles from './GameScreen.module.css';

type Phase = 'preview' | 'draw' | 'run' | 'result';
type Verdict = ReturnType<typeof judge>;

interface Result {
  verdict: Verdict;
  /** 실제 도착 시각(초). 시간 초과로 멈췄어도 끝까지 갔을 때의 값 */
  time: number;
}

interface Playback {
  path: PreparedPath;
  state: RunState;
  speed: number;
  acc: number;
  /** 이 시간을 넘으면 그 자리에서 멈춘다(시간 초과 판정) */
  stopAt: number;
}

const PREVIEW_SPEED = 2;

export function GameScreen() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [levelNo, setLevelNo] = useState(() => loadProgress().unlocked);

  const onClear = useCallback((level: number, time: number) => {
    setProgress((p) => {
      const next = recordClear(p, level, time);
      saveProgress(next);
      return next;
    });
  }, []);

  // 단계가 바뀌면 key로 새로 마운트해 그림과 재생 상태를 깨끗이 비운다
  return (
    <LevelPlay
      key={levelNo}
      levelNo={levelNo}
      unlocked={progress.unlocked}
      onLevel={setLevelNo}
      onClear={onClear}
    />
  );
}

interface Snapshot {
  hit: number;
  reachedGoal: boolean;
  ready: boolean;
  strokes: number;
}

function snapshotOf(status: DrawingStatus, drawing: Drawing): Snapshot {
  return {
    hit: status.hit.filter(Boolean).length,
    reachedGoal: status.reachedGoal,
    ready: status.ready,
    strokes: drawing.strokes.length,
  };
}

function previewPlayback(lv: Level): Playback {
  return { path: preparePath([lv.start, lv.goal]), state: createRun(), speed: PREVIEW_SPEED, acc: 0, stopAt: Infinity };
}

function LevelPlay({
  levelNo,
  unlocked,
  onLevel,
  onClear,
}: {
  levelNo: number;
  unlocked: number;
  onLevel: (n: number) => void;
  onClear: (level: number, time: number) => void;
}) {
  const [level] = useState(() => generateLevel(levelNo));
  const [straight] = useState(() => straightLineTime(level));
  const [init] = useState(() => {
    const drawing = emptyDrawing();
    const status = drawingStatus(level, drawing);
    return { drawing, status, play: previewPlayback(level) };
  });

  const [phase, setPhase] = useState<Phase>('preview');
  const [result, setResult] = useState<Result | null>(null);
  const [fast, setFast] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(() => snapshotOf(init.status, init.drawing));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  const drawingRef = useRef<Drawing>(init.drawing);
  const statusRef = useRef<DrawingStatus>(init.status);
  const playRef = useRef<Playback | null>(init.play);
  const phaseRef = useRef<Phase>('preview');
  const speedRef = useRef(1);
  const pointerRef = useRef<number | null>(null);

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    speedRef.current = fast ? 3 : 1;
  }, [fast]);

  const refreshStatus = useCallback(() => {
    const status = drawingStatus(level, drawingRef.current);
    statusRef.current = status;
    const next = snapshotOf(status, drawingRef.current);
    setSnap((prev) =>
      prev.hit === next.hit &&
      prev.reachedGoal === next.reachedGoal &&
      prev.ready === next.ready &&
      prev.strokes === next.strokes
        ? prev
        : next,
    );
  }, [level]);

  const startPreview = () => {
    playRef.current = previewPlayback(level);
    changePhase('preview');
  };

  const finishRun = useCallback(
    (time: number) => {
      const verdict = judge(level.rule, time);
      setResult({ verdict, time });
      changePhase('result');
      if (verdict === 'success') onClear(level.number, time);
    },
    [level, changePhase, onClear],
  );

  // 그리기 루프. 시뮬레이션은 고정 간격으로만 진행하므로 화면 재생 속도와 판정 결과가 무관하다
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const canvas = canvasRef.current;
      const realDt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
        }
        const view = fitView(cssW, cssH, dpr);
        viewRef.current = view;

        const ph = phaseRef.current;
        const play = playRef.current;
        if (play && (ph === 'preview' || ph === 'run')) {
          const speed = ph === 'run' ? speedRef.current : play.speed;
          play.acc += realDt * speed;
          while (play.acc >= SIM_DT && !play.state.done && play.state.t < play.stopAt) {
            stepRun(play.path, play.state);
            play.acc -= SIM_DT;
          }
          if (ph === 'preview' && play.state.done) changePhase('draw');
          else if (ph === 'run' && (play.state.done || play.state.t >= play.stopAt)) finishRun(simulate(play.path));
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const scene = buildScene(phaseRef.current, level, drawingRef.current, statusRef.current, playRef.current);
          drawScene(ctx, view, cssW, cssH, scene);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [level, changePhase, finishRun]);

  const worldPoint = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas || !view) return null;
    const r = canvas.getBoundingClientRect();
    return toWorld(view, e.clientX - r.left, e.clientY - r.top);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'draw' || pointerRef.current !== null) return;
    const p = worldPoint(e);
    if (!p) return;
    pointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginStroke(level, drawingRef.current, p);
    refreshStatus();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current !== e.pointerId) return;
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    let changed = false;
    for (const ev of coalesced.length ? coalesced : [e.nativeEvent]) {
      const p = worldPoint(ev);
      if (p && addPoint(level, drawingRef.current, p)) changed = true;
    }
    if (changed) refreshStatus();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current !== e.pointerId) return;
    pointerRef.current = null;
    endStroke(drawingRef.current);
    refreshStatus();
  };

  const undo = () => {
    undoStroke(drawingRef.current);
    refreshStatus();
  };

  const clear = () => {
    drawingRef.current = emptyDrawing();
    refreshStatus();
  };

  const go = () => {
    const st = statusRef.current;
    if (!st.ready) return;
    playRef.current = { path: st.path, state: createRun(), speed: 1, acc: 0, stopAt: level.rule.max };
    changePhase('run');
  };

  const retry = () => {
    playRef.current = null;
    setResult(null);
    changePhase('draw');
  };

  const canPrev = levelNo > 1;
  const canNext = levelNo < unlocked;
  const levelTypes = [...new Set(level.boxes.map((b) => b.type))];

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.levelNav}>
          <button
            className={styles.navBtn}
            onClick={() => onLevel(levelNo - 1)}
            disabled={!canPrev || phase === 'run'}
            aria-label="이전 단계"
          >
            ‹
          </button>
          <span className={styles.levelLabel}>{levelNo}단계</span>
          <button
            className={styles.navBtn}
            onClick={() => onLevel(levelNo + 1)}
            disabled={!canNext || phase === 'run'}
            aria-label="다음 단계"
          >
            ›
          </button>
        </div>
        <div className={styles.rule} aria-label="도착 조건">
          {describeRule(level.rule)}
        </div>
      </header>

      <div className={styles.info}>
        <span>
          일직선 <b>{straight.toFixed(1)}초</b>
          <span className={styles.dim}> (박스 효과 제외)</span>
        </span>
        <span className={snap.ready ? styles.ok : undefined}>
          박스 {snap.hit}/{level.boxes.length} · 골 {snap.reachedGoal ? '도착' : '미도착'}
        </span>
      </div>

      <div className={styles.legend}>
        {levelTypes.map((t) => (
          <LegendChip key={t} type={t} />
        ))}
      </div>

      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {phase === 'result' && result && (
          <ResultCard level={level} result={result} onRetry={retry} onNext={() => onLevel(level.number + 1)} />
        )}
      </div>

      <div className={styles.controls}>
        {phase === 'run' ? (
          <>
            <button className={styles.btn} onClick={() => setFast((f) => !f)}>
              {fast ? '보통 속도' : '빨리 감기 x3'}
            </button>
            <button className={styles.btn} onClick={retry}>
              그만하기
            </button>
          </>
        ) : (
          <>
            <button className={styles.btn} onClick={startPreview} disabled={phase === 'result'}>
              미리보기
            </button>
            <button className={styles.btn} onClick={undo} disabled={phase !== 'draw' || snap.strokes === 0}>
              되돌리기
            </button>
            <button className={styles.btn} onClick={clear} disabled={phase !== 'draw' || snap.strokes === 0}>
              지우기
            </button>
            <button
              className={`${styles.btn} ${styles.primary}`}
              onClick={go}
              disabled={phase !== 'draw' || !snap.ready}
            >
              출발
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function buildScene(
  phase: Phase,
  level: Level,
  drawing: Drawing,
  status: DrawingStatus,
  play: Playback | null,
): Scene {
  const hit = status.hit;
  const showPlay = play && (phase === 'preview' || phase === 'run' || phase === 'result');
  let turtle: Scene['turtle'] = null;
  let clock: string | null = null;
  let caption: string | null = null;

  if (showPlay) {
    const { state, path } = play;
    const effect = state.effect && state.t < state.effect.until ? state.effect.type : null;
    turtle = { pose: poseAt(path, state.s), frame: Math.floor(state.s / 6), effect };
    clock = `${state.t.toFixed(2)}초`;
    if (phase === 'preview') caption = `일직선 미리보기 · ${PREVIEW_SPEED}배속`;
    else if (effect) caption = `${BOX_EFFECTS[effect].name} 효과 x${BOX_EFFECTS[effect].mult}`;
  } else {
    turtle = { pose: poseAt(preparePath([level.start, level.goal]), 0), frame: 0, effect: null };
    if (drawing.strokes.length === 0) caption = '출발점부터 선을 그려 박스를 모두 지나 골까지';
  }

  return {
    level,
    path: phase === 'preview' ? [] : pathPoints(level, drawing),
    hit,
    previewLine: phase === 'preview',
    turtle,
    clock,
    caption,
  };
}

function LegendChip({ type }: { type: BoxType }) {
  const src = useMemo(() => spriteCanvas(BOX_ICONS[type]).toDataURL(), [type]);
  const e = BOX_EFFECTS[type];
  return (
    <span className={styles.chip}>
      <img className={styles.chipIcon} src={src} alt="" />
      {e.name} x{e.mult} · {e.duration}초
    </span>
  );
}

const VERDICT_TEXT: Record<Verdict, { title: string; body: (r: Result, lv: Level) => string }> = {
  success: { title: '도착 성공', body: (r) => `${r.time.toFixed(2)}초에 골인했어요.` },
  'too-slow': {
    title: '시간 초과',
    body: (r, lv) => `${lv.rule.max.toFixed(1)}초 안에 못 왔어요. 끝까지 갔다면 ${r.time.toFixed(2)}초예요.`,
  },
  'too-fast': {
    title: '너무 빨라요',
    body: (r, lv) => `${r.time.toFixed(2)}초에 도착했어요. ${lv.rule.min?.toFixed(1)}초보다 늦게 와야 해요.`,
  },
};

function ResultCard({
  level,
  result,
  onRetry,
  onNext,
}: {
  level: Level;
  result: Result;
  onRetry: () => void;
  onNext: () => void;
}) {
  const text = VERDICT_TEXT[result.verdict];
  const ok = result.verdict === 'success';
  return (
    <div className={styles.resultBackdrop}>
      <div className={styles.resultCard} role="dialog" aria-label={text.title}>
        <h2 className={ok ? styles.ok : styles.fail}>{text.title}</h2>
        <p>{text.body(result, level)}</p>
        <p className={styles.dim}>조건: {describeRule(level.rule)}</p>
        <div className={styles.resultActions}>
          <button className={styles.btn} onClick={onRetry}>
            선 고치기
          </button>
          {ok && (
            <button className={`${styles.btn} ${styles.primary}`} onClick={onNext}>
              다음 단계
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
