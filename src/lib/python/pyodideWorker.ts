/// <reference lib="webworker" />
import { PYODIDE_INDEX_URL, type PyCell, type PyRequest, type PyResponse } from './protocol';

interface PyProxyLike {
  toJs?: (opts?: unknown) => unknown;
  destroy?: () => void;
}

interface PyodideApi {
  globals: { set: (name: string, value: unknown) => void; get: (name: string) => unknown };
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (names: string | string[], opts?: { messageCallback?: (m: string) => void; errorCallback?: (m: string) => void }) => Promise<unknown>;
  loadPackagesFromImports: (code: string, opts?: { messageCallback?: (m: string) => void; errorCallback?: (m: string) => void }) => Promise<unknown>;
  setStdout: (opts: { batched: (line: string) => void }) => void;
  setStderr: (opts: { batched: (line: string) => void }) => void;
  version: string;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
let pyodidePromise: Promise<PyodideApi> | null = null;
let activeId = 0;

const post = (msg: PyResponse) => scope.postMessage(msg);
const log = (text: string, stream: 'stdout' | 'stderr' | 'system' = 'system') => post({ id: activeId, type: 'log', stream, text });

const PRELUDE = `
import json as _json
import pandas as pd
import numpy as np
_payload = _json.loads(_ms_input)
df = pd.DataFrame(_payload["rows"], columns=_payload["headers"])
for _c in df.columns:
    _conv = pd.to_numeric(df[_c], errors="coerce")
    if _conv.notna().sum() == df[_c].notna().sum() and df[_c].notna().any():
        df[_c] = _conv
result = None
`;

const EPILOGUE = `
def _ms_export(value):
    if value is None:
        value = df
    if isinstance(value, pd.Series):
        value = value.to_frame(name=value.name if value.name is not None else "value")
    if isinstance(value, pd.DataFrame):
        frame = value
        if not isinstance(frame.index, pd.RangeIndex) or frame.index.name is not None:
            frame = frame.reset_index()
        frame = frame.head(20000)
        frame.columns = [" / ".join(str(p) for p in c) if isinstance(c, tuple) else str(c) for c in frame.columns]
        payload = _json.loads(frame.to_json(orient="split", date_format="iso", default_handler=str, index=False))
        return _json.dumps({"kind": "table", "headers": payload["columns"], "rows": payload["data"], "total": int(len(value))})
    if isinstance(value, (list, tuple)):
        return _json.dumps({"kind": "table", "headers": ["value"], "rows": [[v if isinstance(v, (int, float, str, bool)) or v is None else str(v)] for v in value], "total": len(value)})
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, (int, float, str, bool)):
        return _json.dumps({"kind": "table", "headers": ["result"], "rows": [[value]], "total": 1})
    return _json.dumps({"kind": "table", "headers": ["result"], "rows": [[str(value)]], "total": 1})
_ms_output = _ms_export(result)
`;

async function boot(): Promise<PyodideApi> {
  log('Đang tải Python (Pyodide) lần đầu, cần mạng và có thể mất 10-30 giây...');
  const mod = (await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`)) as {
    loadPyodide: (opts: { indexURL: string }) => Promise<PyodideApi>;
  };
  const py = await mod.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  py.setStdout({ batched: (line) => log(line, 'stdout') });
  py.setStderr({ batched: (line) => log(line, 'stderr') });
  log('Đang nạp pandas và numpy...');
  await py.loadPackage(['numpy', 'pandas'], { messageCallback: () => undefined, errorCallback: (m) => log(m, 'stderr') });
  log(`Python sẵn sàng (Pyodide ${py.version}).`);
  return py;
}

const toCell = (v: unknown): PyCell => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  return String(v);
};

scope.onmessage = async (event: MessageEvent<PyRequest>) => {
  const req = event.data;
  if (req.type !== 'run') return;
  activeId = req.id;
  const started = performance.now();
  try {
    if (!pyodidePromise) pyodidePromise = boot();
    let py: PyodideApi;
    try {
      py = await pyodidePromise;
    } catch (error) {
      pyodidePromise = null;
      throw error;
    }
    await py.loadPackagesFromImports(req.code, { messageCallback: (m) => log(m), errorCallback: (m) => log(m, 'stderr') });
    py.globals.set('_ms_input', JSON.stringify({ headers: req.headers, rows: req.rows }));
    await py.runPythonAsync(PRELUDE);
    await py.runPythonAsync(req.code);
    await py.runPythonAsync(EPILOGUE);
    const raw = py.globals.get('_ms_output');
    const text = typeof raw === 'string' ? raw : String(raw);
    (raw as PyProxyLike | null)?.destroy?.();
    const parsed = JSON.parse(text) as { headers: unknown[]; rows: unknown[][]; total: number };
    post({
      id: req.id,
      type: 'result',
      headers: parsed.headers.map((h) => String(h)),
      rows: parsed.rows.map((r) => r.map(toCell)),
      total: parsed.total,
      ms: Math.round(performance.now() - started),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post({ id: req.id, type: 'error', message: message.split('\n').filter(Boolean).slice(-6).join('\n') });
  }
};
