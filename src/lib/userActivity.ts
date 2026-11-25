type ActivityState = { lastInput: number; presenting: number };

const SHARED_KEY = '__officeUserActivity';
const INPUT_EVENTS = ['keydown', 'pointerdown', 'wheel', 'input', 'touchstart'] as const;

export const AUTO_INSTALL_IDLE_MS = 2 * 60 * 1000;
export const AUTO_INSTALL_POSTPONE_MS = 30 * 60 * 1000;

function sharedState(win: Window = window): ActivityState {
  let owner: Window = win;
  try {
    const top = win.top ?? win;
    void (top as unknown as Record<string, unknown>)[SHARED_KEY];
    owner = top;
  } catch {
    owner = win;
  }
  const host = owner as unknown as Record<string, ActivityState | undefined>;
  host[SHARED_KEY] ??= { lastInput: Date.now(), presenting: 0 };
  return host[SHARED_KEY]!;
}

export function trackUserActivity(win: Window = window) {
  const mark = () => { sharedState(win).lastInput = Date.now(); };
  for (const type of INPUT_EVENTS) win.addEventListener(type, mark, { capture: true, passive: true });
  return () => { for (const type of INPUT_EVENTS) win.removeEventListener(type, mark, { capture: true }); };
}

export function markPresenting(win: Window = window) {
  const state = sharedState(win);
  state.presenting += 1;
  return () => { state.presenting = Math.max(0, state.presenting - 1); };
}

export function activitySnapshot(win: Window = window, now = Date.now()) {
  const state = sharedState(win);
  return { idleMs: Math.max(0, now - state.lastInput), presenting: state.presenting > 0 };
}

export type AutoInstallInput = { hasDocuments: boolean; idleMs: number; presenting: boolean; postponedUntil: number; now: number };

export function autoInstallDecision({ hasDocuments, idleMs, presenting, postponedUntil, now }: AutoInstallInput): 'install' | 'wait' {
  if (presenting || now < postponedUntil) return 'wait';
  if (!hasDocuments) return 'install';
  return idleMs >= AUTO_INSTALL_IDLE_MS ? 'install' : 'wait';
}
