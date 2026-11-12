import type { WorkspaceExitLease } from './workspaceLifecycle';

export const EXIT_SAVE_TIMEOUT_MS = 30_000;

export function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

type CloseOptions = {
  acquire?: () => WorkspaceExitLease | null;
  prepare: () => void;
  save: () => Promise<boolean>;
  finish: (requestId: number, saved: boolean) => Promise<void>;
  setBusy: (busy: boolean) => void;
  reportFailure: () => void;
  saveTimeoutMs?: number;
};

export function createDesktopCloseHandler(options: CloseOptions) {
  let pending: Promise<void> | null = null;
  return (requestId: number): Promise<void> => {
    if (pending) return pending;
    pending = (async () => {
      const lease = options.acquire?.() ?? (options.acquire ? null : { blockInput() {}, release() {} });
      let saved = false;
      let finished = false;
      try {
        if (lease) {
          options.prepare();
          lease.blockInput();
          options.setBusy(true);
          saved = await withTimeout(options.save(), options.saveTimeoutMs ?? EXIT_SAVE_TIMEOUT_MS, false);
        }
      } catch {
        saved = false;
      }
      try {
        await options.finish(requestId, saved);
        finished = saved;
        if (!saved) options.reportFailure();
      } catch {
        options.reportFailure();
      } finally {
        if (lease && !finished) {
          options.setBusy(false);
          lease.release();
        }
      }
    })().finally(() => { pending = null; });
    return pending;
  };
}

export async function installAfterDocumentSave(options: {
  acquire: () => WorkspaceExitLease | null;
  prepare: () => void;
  save: () => Promise<boolean>;
  install: () => Promise<void>;
  saveTimeoutMs?: number;
}): Promise<'installing' | 'blocked' | 'save-failed' | 'install-failed'> {
  const lease = options.acquire();
  if (!lease) return 'blocked';
  let saved = false;
  try {
    options.prepare();
    lease.blockInput();
    saved = await withTimeout(options.save(), options.saveTimeoutMs ?? EXIT_SAVE_TIMEOUT_MS, false);
  } catch {
    saved = false;
  }
  if (!saved) {
    lease.release();
    return 'save-failed';
  }
  try {
    await options.install();
    return 'installing';
  } catch {
    lease.release();
    return 'install-failed';
  }
}
