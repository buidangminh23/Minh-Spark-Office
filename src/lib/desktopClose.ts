import type { WorkspaceExitLease } from './workspaceLifecycle';

type CloseOptions = {
  acquire?: () => WorkspaceExitLease | null;
  prepare: () => void;
  save: () => Promise<boolean>;
  finish: (requestId: number, saved: boolean) => Promise<void>;
  setBusy: (busy: boolean) => void;
  reportFailure: () => void;
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
          saved = await options.save();
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
}): Promise<'installing' | 'blocked' | 'save-failed' | 'install-failed'> {
  const lease = options.acquire();
  if (!lease) return 'blocked';
  let saved = false;
  try {
    options.prepare();
    lease.blockInput();
    saved = await options.save();
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
