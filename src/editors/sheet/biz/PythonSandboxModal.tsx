import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Play, Square } from 'lucide-react';
import { ProDialog } from '../SheetProModals';
import { runPython, isPythonSandboxLoaded, type PyLogStream } from '../../../lib/python/pythonSandbox';
import type { PyCell, PyTableResult } from '../../../lib/python/protocol';

type Snippet = 'describe' | 'groupby' | 'sort' | 'filter' | 'pivot';

interface LogLine {
  text: string;
  stream: PyLogStream | 'ok' | 'err';
}

const PREVIEW_ROWS = 200;

const pyName = (name: string) => JSON.stringify(name);

function buildSnippet(type: Snippet, headers: string[], rows: PyCell[][]) {
  const numIdx = headers.findIndex((_, i) => rows.some((r) => typeof r[i] === 'number'));
  const numCol = pyName(headers[numIdx >= 0 ? numIdx : Math.min(1, headers.length - 1)] ?? 'value');
  const catIdx = headers.findIndex((_, i) => i !== numIdx && rows.some((r) => typeof r[i] === 'string'));
  const catCol = pyName(headers[catIdx >= 0 ? catIdx : 0] ?? 'group');
  switch (type) {
    case 'describe':
      return '# Thống kê mô tả các cột số\nresult = df.describe()';
    case 'groupby':
      return `# Gom nhóm và tính tổng, trung bình, số dòng\nresult = df.groupby(${catCol})[${numCol}].agg(["sum", "mean", "count"])`;
    case 'sort':
      return `# Sắp xếp giảm dần\nresult = df.sort_values(by=${numCol}, ascending=False)`;
    case 'filter':
      return `# Lọc dòng lớn hơn trung bình\nresult = df[df[${numCol}] > df[${numCol}].mean()]`;
    case 'pivot':
      return `# Bảng tổng hợp\nresult = pd.pivot_table(df, index=${catCol}, values=${numCol}, aggfunc="sum", margins=True, margins_name="Tổng")`;
  }
}

const formatCell = (cell: PyCell) => {
  if (cell === null) return '';
  if (typeof cell === 'number') return cell.toLocaleString('vi-VN', { maximumFractionDigits: 6 });
  return String(cell);
};

const LOG_COLORS: Record<LogLine['stream'], string> = {
  stdout: '#e2e8f0',
  stderr: '#fca5a5',
  system: '#94a3b8',
  ok: '#4ade80',
  err: '#f87171',
};

export function PythonSandboxModal({
  headers,
  rows,
  onExportPythonResult,
  onClose,
}: {
  headers: string[];
  rows: PyCell[][];
  onExportPythonResult: (headers: string[], rows: PyCell[][]) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(() => `# Biến df là bảng đang chọn (${rows.length} dòng, ${headers.length} cột)\n# Gán kết quả vào biến result để xem và xuất ra trang tính\n${buildSnippet('describe', headers, rows)}`);
  const [logs, setLogs] = useState<LogLine[]>(() => [
    { text: `Đã nhận bảng ${rows.length} dòng × ${headers.length} cột vào biến df (pandas).`, stream: 'system' },
    ...(isPythonSandboxLoaded() ? [] : [{ text: 'Lần chạy đầu sẽ tải Python 3.14 + pandas từ mạng (khoảng 15 MB).', stream: 'system' as const }]),
  ]);
  const [output, setOutput] = useState<PyTableResult | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  }, [logs]);

  const pushLog = (text: string, stream: LogLine['stream']) => setLogs((prev) => [...prev.slice(-300), { text, stream }]);

  const run = async () => {
    if (running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    pushLog(`>>> Chạy lúc ${new Date().toLocaleTimeString('vi-VN')}`, 'system');
    try {
      const result = await runPython(code, { headers, rows }, { onLog: pushLog, signal: controller.signal });
      setOutput(result);
      const shown = result.rows.length < result.total ? ` (hiện ${result.rows.length})` : '';
      pushLog(`Xong sau ${(result.ms / 1000).toLocaleString('vi-VN')} giây: ${result.total} dòng × ${result.headers.length} cột${shown}.`, 'ok');
    } catch (error) {
      pushLog(error instanceof Error ? error.message : String(error), 'err');
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void run();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart: s, selectionEnd: e } = el;
      const next = `${code.slice(0, s)}    ${code.slice(e)}`;
      setCode(next);
      requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
    }
  };

  const exportResult = () => {
    if (!output) return;
    onExportPythonResult(output.headers, output.rows);
  };

  return (
    <ProDialog
      title="Python Sandbox"
      subtitle="Chạy Python 3.14 với pandas, numpy ngay trong máy, không gửi dữ liệu đi đâu"
      width={860}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={exportResult} disabled={!output || running}>
            <FileSpreadsheet size={15} /> Xuất kết quả ra trang tính mới
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginRight: 4 }}>Mẫu:</span>
            {(['describe', 'groupby', 'pivot', 'sort', 'filter'] as Snippet[]).map((s) => (
              <button key={s} type="button" className="btn btn-sm" onClick={() => setCode(buildSnippet(s, headers, rows))}>
                {s}
              </button>
            ))}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            aria-label="Mã Python"
            style={{
              width: '100%',
              height: 220,
              fontFamily: 'Consolas, Menlo, monospace',
              fontSize: 12,
              background: '#0f172a',
              color: '#e2e8f0',
              padding: 10,
              borderRadius: 6,
              border: '1px solid #1e293b',
              lineHeight: 1.5,
              resize: 'vertical',
              tabSize: 4,
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {running ? (
              <button type="button" className="btn" onClick={stop}>
                <Square size={14} /> Dừng
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => void run()}>
                <Play size={14} /> Chạy (Ctrl+Enter)
              </button>
            )}
            {running && <span style={{ fontSize: 12, color: '#64748b' }}>Đang chạy...</span>}
          </div>
          <div
            ref={logBoxRef}
            role="log"
            aria-live="polite"
            style={{
              background: '#1e293b',
              fontFamily: 'Consolas, Menlo, monospace',
              fontSize: 11,
              padding: 8,
              borderRadius: 6,
              height: 110,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {logs.map((l, i) => (
              <div key={i} style={{ color: LOG_COLORS[l.stream] }}>
                {l.text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
            Kết quả {output ? `(${output.total.toLocaleString('vi-VN')} dòng)` : ''}
          </div>
          {output ? (
            <div style={{ maxHeight: 390, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                    {output.headers.map((h, i) => (
                      <th key={i} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {output.rows.slice(0, PREVIEW_ROWS).map((row, r) => (
                    <tr key={r} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {row.map((cell, c) => (
                        <td key={c} style={{ padding: '5px 8px', textAlign: typeof cell === 'number' ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                          {formatCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {output.rows.length > PREVIEW_ROWS && (
                <div style={{ padding: 6, fontSize: 11, color: '#64748b' }}>
                  Xem trước {PREVIEW_ROWS} dòng đầu, xuất ra trang tính sẽ có đủ {output.rows.length.toLocaleString('vi-VN')} dòng.
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                height: 390,
                border: '2px dashed #cbd5e1',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: 13,
                textAlign: 'center',
                padding: 16,
              }}
            >
              Bấm Chạy để xem kết quả. Nếu không gán result, kết quả là df sau khi chạy.
            </div>
          )}
        </div>
      </div>
    </ProDialog>
  );
}
