export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export type PyCell = string | number | boolean | null;

export interface PyRunRequest {
  id: number;
  type: 'run';
  code: string;
  headers: string[];
  rows: PyCell[][];
}

export type PyRequest = PyRunRequest;

export type PyResponse =
  | { id: number; type: 'log'; stream: 'stdout' | 'stderr' | 'system'; text: string }
  | { id: number; type: 'result'; headers: string[]; rows: PyCell[][]; total: number; ms: number }
  | { id: number; type: 'error'; message: string };

export interface PyTableResult {
  headers: string[];
  rows: PyCell[][];
  total: number;
  ms: number;
}
