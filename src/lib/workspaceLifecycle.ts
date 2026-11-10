export function createWorkspaceLifecycle() {
  const busyOwners = new Set<symbol>();
  const listeners = new Set<() => void>();
  let exiting = false;
  const notify = () => { for (const listener of listeners) listener(); };
  return {
    isBlocked: () => exiting || busyOwners.size > 0,
    setBusy(owner: symbol, busy: boolean) {
      if (busy === busyOwners.has(owner)) return;
      if (busy) busyOwners.add(owner);
      else busyOwners.delete(owner);
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    acquireExit(): (() => void) | null {
      if (exiting || busyOwners.size) return null;
      exiting = true;
      notify();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        exiting = false;
        notify();
      };
    },
  };
}

export const workspaceLifecycle = createWorkspaceLifecycle();

export async function trackWorkspaceOperation<T>(work: () => Promise<T>, lifecycle = workspaceLifecycle): Promise<T> {
  const owner = Symbol('workspace-operation');
  lifecycle.setBusy(owner, true);
  try {
    return await work();
  } finally {
    lifecycle.setBusy(owner, false);
  }
}

export type WorkspaceExitLease = { blockInput: () => void; release: () => void };

export function acquireWorkspaceExit(
  lifecycle = workspaceLifecycle,
  target: EventTarget | null = typeof window === 'undefined' ? null : window,
): WorkspaceExitLease | null {
  const release = lifecycle.acquireExit();
  if (!release) return null;
  const events = ['keydown', 'keyup', 'beforeinput', 'pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'paste', 'cut', 'drop', 'touchstart'];
  const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  return {
    blockInput() {
      for (const name of events) target?.addEventListener(name, block, { capture: true, passive: false });
    },
    release() {
      for (const name of events) target?.removeEventListener(name, block, { capture: true });
      release();
    },
  };
}
