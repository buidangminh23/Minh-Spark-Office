import type { WorkbookData } from './sheetTypes';
import type { CodecRequest, CodecResponse } from './xlsxCodecProtocol';

const WORKER_IDLE_MS = 30_000;

type Pending = { resolve: (value: WorkbookData | ArrayBuffer) => void; reject: (error: Error) => void };
type CodecJob = { op: 'read'; buffer: ArrayBuffer; fileName: string } | { op: 'write'; workbook: WorkbookData; macroEnabled?: boolean };

class CodecWorkerUnavailable extends Error {}

let worker: Worker | null = null;
let workerBroken = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

const stopWorker = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  worker?.terminate();
  worker = null;
};

const failPending = () => {
  const waiting = [...pending.values()];
  pending.clear();
  stopWorker();
  waiting.forEach((job) => job.reject(new CodecWorkerUnavailable()));
};

const scheduleIdleStop = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = pending.size ? null : setTimeout(stopWorker, WORKER_IDLE_MS);
};

const handleResponse = (event: MessageEvent<CodecResponse>) => {
  const response = event.data;
  const job = pending.get(response.id);
  if (!job) return;
  pending.delete(response.id);
  scheduleIdleStop();
  if (response.ok) job.resolve(response.result);
  else job.reject(new Error(response.message));
};

const startWorker = () => {
  if (worker) return worker;
  if (workerBroken || typeof Worker === 'undefined') return null;
  try {
    const created = new Worker(new URL('./xlsxWorker.ts', import.meta.url), { type: 'module', name: 'spreadsheet-codec' });
    created.onmessage = handleResponse;
    created.onerror = () => { workerBroken = true; failPending(); };
    created.onmessageerror = () => { workerBroken = true; failPending(); };
    worker = created;
    return created;
  } catch {
    workerBroken = true;
    return null;
  }
};

const runOnWorker = (job: CodecJob) => new Promise<WorkbookData | ArrayBuffer>((resolve, reject) => {
  const target = startWorker();
  if (!target) { reject(new CodecWorkerUnavailable()); return; }
  const id = nextId++;
  pending.set(id, { resolve, reject });
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  try {
    target.postMessage({ id, ...job } satisfies CodecRequest);
  } catch {
    pending.delete(id);
    scheduleIdleStop();
    reject(new CodecWorkerUnavailable());
  }
});

const runOnMainThread = async (job: CodecJob) => {
  const codec = await import('./xlsxCodec');
  return job.op === 'read' ? codec.readSpreadsheet(job.buffer, job.fileName) : codec.writeWorkbookXlsx(job.workbook, { macroEnabled: job.macroEnabled });
};

const run = async (job: CodecJob) => {
  try {
    return await runOnWorker(job);
  } catch (error) {
    if (!(error instanceof CodecWorkerUnavailable)) throw error;
    return runOnMainThread(job);
  }
};

export const readSpreadsheetOffThread = async (buffer: ArrayBuffer, fileName: string) =>
  await run({ op: 'read', buffer, fileName }) as WorkbookData;

export const writeWorkbookXlsxOffThread = async (workbook: WorkbookData, macroEnabled = false) =>
  await run({ op: 'write', workbook, macroEnabled }) as ArrayBuffer;
