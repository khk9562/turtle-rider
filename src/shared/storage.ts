const KEY = 'turtle-rider:v1';

export interface Progress {
  /** 도전할 수 있는 가장 높은 단계 */
  unlocked: number;
  /** 단계별 성공 기록(초) */
  cleared: Record<number, number>;
}

const EMPTY: Progress = { unlocked: 1, cleared: {} };

/** 사생활 보호 모드 등에서 저장소 접근이 막혀도 게임은 그대로 돌아가야 한다 */
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      unlocked: Math.max(1, Number(p.unlocked) || 1),
      cleared: typeof p.cleared === 'object' && p.cleared ? p.cleared : {},
    };
  } catch {
    return EMPTY;
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 저장 실패는 무시한다
  }
}

export function recordClear(p: Progress, level: number, time: number): Progress {
  return {
    unlocked: Math.max(p.unlocked, level + 1),
    cleared: { ...p.cleared, [level]: time },
  };
}
