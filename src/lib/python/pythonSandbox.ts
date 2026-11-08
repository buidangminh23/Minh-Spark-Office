import type { PyCell, PyResponse, PyTableResult } from './protocol';

export type PyLogStream = 'stdout' | 'stderr' | 'system';

export interface RunPythonOptions {
  onLog?: (text: string, stream: PyLogStream) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

let worker: Worker | null = null;
let nextId = 1;
let busy = false;

const spawn = () =>
  new Worker(new URL('./pyodideWorker.ts', import.meta.url), { type: 'module', name: 'python-sandbox' });

export function resetPythonSandbox() {
  worker?.terminate();
  worker = null;
  busy = false;
}

export function isPythonSandboxLoaded() {
  return worker !== null;
}

export function runPython(
  code: string,
  table: { headers: string[]; rows: PyCell[][] },
  { onLog, signal, timeoutMs = 120_000 }: RunPythonOptions = {},
): Promise<PyTableResult> {
  if (busy) return Promise.reject(new Error('Python đang chạy một lệnh khác.'));
  if (!worker) worker = spawn();
  const w = worker;
  const id = nextId++;
  busy = true;

  return new Promise<PyTableResult>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      busy = false;
      clearTimeout(timer);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const kill = (message: string) => {
      resetPythonSandbox();
      finish(() => reject(new Error(message)));
    };
    const onAbort = () => kill('Đã dừng lệnh Python.');
    const onError = (event: ErrorEvent) => kill(event.message || 'Không khởi động được Python.');
    const onMessage = (event: MessageEvent<PyResponse>) => {
      const msg = event.data;
      if (msg.id !== id) return;
      if (msg.type === 'log') onLog?.(msg.text, msg.stream);
      else if (msg.type === 'result') finish(() => resolve({ headers: msg.headers, rows: msg.rows, total: msg.total, ms: msg.ms }));
      else finish(() => reject(new Error(msg.message)));
    };
    const timer = setTimeout(() => kill(`Lệnh Python chạy quá ${Math.round(timeoutMs / 1000)} giây nên đã dừng.`), timeoutMs);

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort);
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ id, type: 'run', code, headers: table.headers, rows: table.rows });
  });
}
