import { checkConversionAbort, type ConversionOptions } from './conversionTypes';

export type OfficeLayoutSession = ReturnType<typeof openOfficeLayoutSession>;

export function openOfficeLayoutSession() {
  const token = crypto.randomUUID();
  const channel = new BroadcastChannel(`office-layout-${token}`);
  const lifecycle = new AbortController();
  let acknowledgeReady: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => { acknowledgeReady = resolve; });
  let lastSeen = Date.now();
  channel.onmessage = ({ data }) => {
    lastSeen = Date.now();
    if (data?.type === 'ready') acknowledgeReady?.();
    if (data?.type === 'closed') lifecycle.abort(new Error('Cửa sổ giữ bố cục đã đóng.'));
  };
  const popup = window.open(`/office-layout.html#${token}`, '_blank', 'popup,width=540,height=390');
  if (!popup) {
    channel.close();
    throw new Error('Hãy cho phép Office 23 mở cửa sổ giữ bố cục rồi chuyển đổi lại.');
  }
  const heartbeat = window.setInterval(() => {
    channel.postMessage({ type: 'ping' });
    if (Date.now() - lastSeen > 45_000) lifecycle.abort(new Error('Mất kết nối với cửa sổ giữ bố cục. Hãy chạy lại chuyển đổi.'));
  }, 5000);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    lifecycle.abort();
    channel.postMessage({ type: 'close' });
    channel.close();
    window.removeEventListener('pagehide', close);
  }
  window.addEventListener('pagehide', close, { once: true });
  return {
    close,
    async render(file: File, options: ConversionOptions): Promise<Blob> {
      checkConversionAbort(options);
      const id = crypto.randomUUID();
      const signal = lifecycle.signal;
      signal.throwIfAborted();
      options.onProgress?.('Đang mở bộ giữ bố cục…');
      return new Promise((resolve, reject) => {
        const finish = () => {
          clearTimeout(timeout);
          channel.removeEventListener('message', message);
          signal.removeEventListener('abort', abort);
          options.signal?.removeEventListener('abort', abort);
        };
        const abort = () => {
          finish();
          reject(options.signal?.reason ?? signal.reason ?? new DOMException('Đã dừng chuyển đổi.', 'AbortError'));
          close();
        };
        const message = ({ data }: MessageEvent) => {
          if (data?.id !== id) return;
          if (data.type === 'progress') options.onProgress?.(data.message);
          if (data.type === 'result' || data.type === 'error') {
            finish();
            if (data.type === 'result' && data.pdf instanceof Blob && data.pdf.size) resolve(data.pdf);
            else reject(new Error(data.message || 'Bộ giữ bố cục không tạo được tệp.'));
          }
        };
        const timeout = window.setTimeout(() => {
          lifecycle.abort(new Error('Bộ giữ bố cục mất quá nhiều thời gian. Hãy thử với tệp nhỏ hơn.'));
        }, 240_000);
        channel.addEventListener('message', message);
        signal.addEventListener('abort', abort, { once: true });
        options.signal?.addEventListener('abort', abort, { once: true });
        void ready.then(() => {
          if (!closed) channel.postMessage({ type: 'render', id, file });
        });
      });
    },
  };
}
