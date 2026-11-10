import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isDesktop } from '../lib/desktop';
import { createDesktopCloseHandler } from '../lib/desktopClose';
import { saveActiveDocumentForExit } from '../lib/documentCloser';
import { useUi } from './ui';
import { acquireWorkspaceExit } from '../lib/workspaceLifecycle';

export function DesktopCloseGuard() {
  const { showBusy, toast } = useUi();
  useEffect(() => {
    if (!isDesktop()) return;
    let alive = true;
    let unlisten: (() => void) | undefined;
    const reportFailure = () => {
      if (alive) toast('Chưa lưu xong tài liệu nên ứng dụng vẫn mở. Vui lòng thử lưu lại trước khi thoát.', true);
    };
    const close = createDesktopCloseHandler({
      acquire: acquireWorkspaceExit,
      prepare: () => flushSync(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }),
      save: saveActiveDocumentForExit,
      finish: async (requestId, saved) => {
        const approved = alive && saved;
        await invoke('finish_close_request', { requestId, saved: approved });
        if (saved && !approved) throw new Error('Workspace changed before exit');
      },
      setBusy: (busy) => { if (alive) showBusy(busy ? 'Đang lưu tài liệu trước khi thoát…' : null); },
      reportFailure,
    });
    void listen<number>('office-close-requested', ({ payload }) => { if (alive) void close(payload); })
      .then(async (stop) => {
        if (!alive) { stop(); return; }
        unlisten = stop;
        const pending = await invoke<number | null>('pending_close_request');
        if (alive && pending !== null) await close(pending);
      })
      .catch(reportFailure);
    return () => { alive = false; unlisten?.(); };
  }, [showBusy, toast]);
  return null;
}
