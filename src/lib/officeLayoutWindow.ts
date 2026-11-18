import { checkNativeFile, nativeOutputMime } from './officeNativeFormats';

const assetRoot = '/layout-engine/2.3.1/';
const token = location.hash.slice(1);
const status = document.querySelector<HTMLElement>('#status')!;
const filename = document.querySelector<HTMLElement>('#filename')!;
const progress = document.querySelector<HTMLProgressElement>('progress')!;

async function unpack(name: string, type: string, signal: AbortSignal) {
  const response = await fetch(assetRoot + name, { signal });
  if (!response.ok) throw new Error('Không tải được bộ giữ bố cục. Hãy kiểm tra kết nối rồi thử lại.');
  const asset = await response.blob();
  const header = new Uint8Array(await asset.slice(0, 2).arrayBuffer());
  const bytes = header[0] === 31 && header[1] === 139
    ? await new Response(asset.stream().pipeThrough(new DecompressionStream('gzip'))).blob() : asset;
  return URL.createObjectURL(new Blob([bytes], { type }));
}

function start() {
  const channel = new BroadcastChannel(`office-layout-${token}`);
  const lifetime = new AbortController();
  const urls: string[] = [];
  let worker: Worker | undefined;
  let active = '';
  let lastPing = Date.now();
  let disposed = false;
  const notify = (message: string) => {
    status.textContent = message;
    channel.postMessage({ type: 'progress', id: active, message });
  };
  const stop = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(heartbeat);
    lifetime.abort();
    worker?.terminate();
    urls.forEach(URL.revokeObjectURL);
    channel.postMessage({ type: 'closed' });
    channel.close();
    window.close();
  };
  const heartbeat = window.setInterval(() => {
    if (Date.now() - lastPing > 120_000) stop();
  }, 15_000);
  window.addEventListener('pagehide', stop, { once: true });
  function request(type: string, fields: Record<string, unknown>, response: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
    const engine = worker!;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        engine.removeEventListener('message', message);
        engine.removeEventListener('error', failure);
      };
      const failure = () => { cleanup(); reject(new Error('Bộ giữ bố cục gặp lỗi khi đọc tài liệu.')); };
      const message = ({ data }: MessageEvent) => {
        if (data.id !== active) return;
        if (data.type === 'progress' && typeof data.progress?.percent === 'number') {
          progress.max = 100;
          progress.value = data.progress.percent;
        }
        if (data.type === response) { cleanup(); resolve(data.data); }
        if (data.type === 'error') { cleanup(); reject(new Error('LibreOffice không thể mở hoặc chuyển tệp này. Hãy kiểm tra định dạng và mật khẩu của tệp.')); }
      };
      engine.addEventListener('message', message);
      engine.addEventListener('error', failure);
      engine.postMessage({ type, id: active, ...fields });
    });
  }
  async function initialize() {
    if (worker) return;
    if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      throw new Error('Cửa sổ này chưa hỗ trợ bộ giữ bố cục. Hãy mở Office 23 trong Chrome hoặc Edge, hoặc chọn dàn lại nội dung.');
    }
    notify('Đang nạp bộ giữ bố cục LibreOffice…');
    const assetUrl = async (name: string, type: string) => {
      const url = await unpack(name, type, lifetime.signal);
      if (disposed) { URL.revokeObjectURL(url); lifetime.signal.throwIfAborted(); }
      urls.push(url);
      return url;
    };
    const url = (name: string) => new URL(assetRoot + name, location.href).href;
    const [wasm, data, script] = await Promise.all([
      assetUrl('soffice.wasm.gz', 'application/wasm'), assetUrl('soffice.data.gz', 'application/octet-stream'),
      location.hostname === 'tauri.localhost' ? assetUrl('soffice.js', 'text/javascript') : url('soffice.js'),
    ]);
    worker = new Worker(url('browser.worker.global.js?formats=2'));
    try {
      await request('init', { sofficeJs: script, sofficeWorkerJs: url('soffice.worker.js'), sofficeWasm: wasm, sofficeData: data }, 'ready');
    } catch (error) {
      worker.terminate();
      worker = undefined;
      urls.splice(0).forEach(URL.revokeObjectURL);
      throw error;
    }
  }
  channel.onmessage = async ({ data }) => {
    if (data?.type === 'ping') { lastPing = Date.now(); channel.postMessage({ type: 'ready' }); return; }
    if (data?.type === 'close') { stop(); return; }
    if (data?.type !== 'render' || active || !(data.file instanceof File)) return;
    active = data.id;
    try {
      const file: File = data.file;
      if (!file.size || file.size > 50 * 1024 * 1024) throw new Error('Hãy chọn tệp Office có dung lượng tối đa 50 MB.');
      filename.textContent = file.name;
      progress.removeAttribute('value');
      await initialize();
      const outputFormat = data.outputFormat;
      if (!['pdf', 'docx', 'doc', 'dot', 'odt', 'fodt', 'rtf', 'xlsx', 'xls', 'xlt', 'ods', 'fods', 'pptx', 'ppt', 'pps', 'pot', 'odp', 'fodp'].includes(outputFormat)) throw new Error('Định dạng đầu ra chưa được hỗ trợ.');
      notify(outputFormat === 'pdf' ? 'Đang dàn trang theo bố cục in…' : 'Đang chuyển sang ' + outputFormat.toUpperCase() + '…');
      const binaryFormat = ({ dot: 'doc', xlt: 'xls', pps: 'ppt' } as Record<string, string>)[outputFormat] ?? outputFormat;
      let bytes = await request('convert', { inputData: new Uint8Array(await file.arrayBuffer()), inputExt: file.name.split('.').pop()?.toLowerCase(), outputFormat: binaryFormat }, 'result');
      if (!bytes?.byteLength || bytes.byteLength > 200 * 1024 * 1024) throw new Error('Bộ chuyển đổi chưa tạo được tệp trong giới hạn 200 MB.');
      if (outputFormat === 'dot' || outputFormat === 'xlt') bytes = await (await import('./legacyOfficeTemplates')).createLegacyTemplate(bytes, outputFormat);
      const blob = new Blob([bytes], { type: nativeOutputMime(outputFormat) });
      await checkNativeFile(await blob.arrayBuffer(), outputFormat);
      channel.postMessage({ type: 'result', id: active, blob });
      status.textContent = 'Đã dàn trang xong.';
      progress.value = progress.max;
    } catch (error) {
      if (!disposed) {
        const message = error instanceof Error ? error.message : 'Không chuyển được tệp.';
        status.textContent = message;
        channel.postMessage({ type: 'error', id: active, message });
      }
    } finally { active = ''; }
  };
  channel.postMessage({ type: 'ready' });
}

if (/^[a-f\d-]{36}$/i.test(token)) start();
else status.textContent = 'Hãy chọn Chuyển định dạng từ thanh bên của Office 23.';
