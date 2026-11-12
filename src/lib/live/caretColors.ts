import type { Awareness } from 'y-protocols/awareness';
import { TEAM_COLORS } from '../teams';

type CaretUser = { name?: unknown; color?: unknown; uid?: unknown };

export function pickFreeColor(preferred: string, taken: ReadonlySet<string>, palette: readonly string[] = TEAM_COLORS) {
  if (!taken.has(preferred)) return preferred;
  const start = Math.max(0, palette.indexOf(preferred));
  const stride = palette.length % 3 === 0 ? 1 : 3;
  for (let step = 1; step <= palette.length; step++) {
    const candidate = palette[(start + step * stride) % palette.length];
    if (!taken.has(candidate)) return candidate;
  }
  return preferred;
}

function userOf(state: unknown): CaretUser | null {
  const user = (state as { user?: CaretUser } | null)?.user;
  return user && typeof user === 'object' ? user : null;
}

export function keepCaretColorUnique(awareness: Awareness, uid: string) {
  const resolve = () => {
    const mine = userOf(awareness.getLocalState());
    if (!mine || typeof mine.color !== 'string') return;
    const taken = new Set<string>();
    for (const [clientId, state] of awareness.getStates()) {
      const other = userOf(state);
      if (clientId === awareness.clientID || !other || other.uid === uid || typeof other.color !== 'string') continue;
      if (clientId < awareness.clientID) taken.add(other.color);
    }
    const color = pickFreeColor(mine.color, taken);
    if (color !== mine.color || mine.uid !== uid) awareness.setLocalStateField('user', { ...mine, color, uid });
  };
  resolve();
  awareness.on('change', resolve);
  return () => awareness.off('change', resolve);
}

export function caretColorsByUid(awareness: Awareness) {
  const colors = new Map<string, string>();
  for (const state of awareness.getStates().values()) {
    const user = userOf(state);
    if (user && typeof user.uid === 'string' && typeof user.color === 'string' && !colors.has(user.uid)) colors.set(user.uid, user.color);
  }
  return colors;
}
