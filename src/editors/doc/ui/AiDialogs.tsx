import { useEffect, useRef, useState } from 'react';
import { Languages, Settings, Sparkles, Square } from 'lucide-react';
import { useDoc } from '../DocContext';
import { AI_ACTIONS, LANGUAGES, describeProvider, getApiKey, runAi, setApiKey, translateText, type AiAction } from '../ai';
import Modal from './Modal';

const selectionOrAll = (editor: ReturnType<typeof useDoc>['editor']) => {
  const { from, to, empty } = editor.state.selection;
  return empty ? { text: editor.getText({ blockSeparator: '\n' }), range: null } : { text: editor.state.doc.textBetween(from, to, '\n'), range: { from, to } };
};

const toParagraphs = (text: string) => text.trim().split(/\n{2,}|\n(?=- )|\n/).filter((line) => line.trim()).map((line) => {
  const bullet = /^\s*[-•*]\s+/.test(line);
  const clean = line.replace(/^\s*[-•*]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1');
  return { type: 'paragraph', content: [{ type: 'text', text: bullet ? `• ${clean}` : clean }] };
});

function useStreamingTask() {
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const start = async (task: (onText: (t: string) => void, signal: AbortSignal) => Promise<string>) => {
    controller.current?.abort();
    controller.current = new AbortController();
    setOutput('');
    setError('');
    setBusy(true);
    try {
      let streamed = '';
      const result = await task((chunk) => { streamed += chunk; setOutput(streamed); }, controller.current.signal);
      setOutput(result || streamed);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { output, setOutput, busy, error, start, stop: () => controller.current?.abort() };
}

function ResultActions({ output, range, onDone }: { output: string; range: { from: number; to: number } | null; onDone: () => void }) {
  const { editor, ui } = useDoc();
  return (
    <>
      <button className="btn" disabled={!output} onClick={() => { void navigator.clipboard.writeText(output); ui.toast('Đã sao chép kết quả'); }}>Sao chép</button>
      <button className="btn" disabled={!output} onClick={() => { editor.chain().focus().insertContentAt(range ? range.to : editor.state.selection.to, toParagraphs(output)).run(); onDone(); }}>Chèn bên dưới</button>
      <button className="btn btn-primary" disabled={!output || !range} title={range ? '' : 'Chọn đoạn văn trước để thay thế'} onClick={() => { if (range) editor.chain().focus().insertContentAt(range, toParagraphs(output)).run(); onDone(); }}>Thay đoạn chọn</button>
    </>
  );
}

export function AiDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [{ text, range }] = useState(() => selectionOrAll(ctx.editor));
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('');
  const task = useStreamingTask();
  useEffect(() => { void describeProvider().then(setProvider); }, []);
  const go = (action: AiAction) => void task.start((onText, signal) => runAi(action, text, prompt, onText, signal));
  const configure = async () => {
    const res = await ctx.ui.ask({ title: 'Cài đặt 23 AI', message: 'Nhập API key Claude (bắt đầu bằng sk-ant-). Key chỉ lưu trong trình duyệt trên máy này và được gửi thẳng tới Anthropic khi dùng AI. Để trống để xoá key.', fields: [{ name: 'key', label: 'Anthropic API key', type: 'password', value: getApiKey() }], confirmText: 'Lưu' });
    if (!res) return;
    setApiKey(String(res.key));
    setProvider(await describeProvider());
    ctx.ui.toast(String(res.key).trim() ? 'Đã lưu API key Claude' : 'Đã xoá API key');
  };
  return (
    <Modal title="23 AI" subtitle={<>Đang dùng: <strong>{provider || '…'}</strong> · Áp dụng cho {range ? 'đoạn đang chọn' : 'toàn bộ tài liệu'} ({text.trim().split(/\s+/).filter(Boolean).length} từ)</>} icon={<Sparkles size={20} />} onClose={onClose} width={720}
      actions={<><button className="btn" onClick={() => void configure()}><Settings size={14} /> Cài đặt</button><span className="spacer" />{task.busy ? <button className="btn" onClick={task.stop}><Square size={13} /> Dừng</button> : <ResultActions output={task.output} range={range} onDone={onClose} />}</>}>
      <div className="ai-actions">
        {AI_ACTIONS.map((a) => <button key={a.id} className="btn" disabled={task.busy} onClick={() => go(a.id)}>{a.label}</button>)}
      </div>
      <div className="ai-prompt">
        <input className="text-field" placeholder="Hoặc nhập yêu cầu riêng, ví dụ: Viết lại thành email gửi khách hàng…" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && prompt.trim() && go('custom')} />
        <button className="btn btn-primary" disabled={!prompt.trim() || task.busy} onClick={() => go('custom')}>Gửi</button>
      </div>
      {task.error && <div className="form-error">{task.error}</div>}
      <textarea className="text-field ai-output" rows={12} value={task.busy && !task.output ? '23 AI đang xử lý…' : task.output} onChange={(e) => task.setOutput(e.target.value)} placeholder="Kết quả hiện ở đây — sửa được trước khi chèn." />
    </Modal>
  );
}

export function parallelRows(source: string, translated: string): [string, string][] {
  const left = source.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const right = translated.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const count = Math.max(left.length, 1);
  const rows: [string, string][] = left.map((line, i) => [line, right[i] ?? '']);
  if (right.length > count) rows[count - 1][1] = right.slice(count - 1).join(' ');
  return rows;
}

function insertParallel(ctx: ReturnType<typeof useDoc>, source: string, translated: string, language: string, range: { from: number; to: number } | null) {
  const cell = (text: string, type = 'tableCell') => ({ type, content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
  const rows = parallelRows(source, translated).map(([a, b]) => ({ type: 'tableRow', content: [cell(a), cell(b)] }));
  const table = { type: 'table', attrs: { tableStyle: 'lines' }, content: [{ type: 'tableRow', attrs: { repeatHeader: true }, content: [cell('Bản gốc', 'tableHeader'), cell(`Bản dịch (${language})`, 'tableHeader')] }, ...rows] };
  const at = range ? range.to : ctx.editor.state.doc.content.size;
  ctx.editor.chain().focus().insertContentAt(at, table).run();
  ctx.ui.toast(`Đã chèn bảng song ngữ ${rows.length} dòng`);
}

export function TranslateDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [{ text, range }] = useState(() => selectionOrAll(ctx.editor));
  const [target, setTarget] = useState('en');
  const task = useStreamingTask();
  const openGoogle = () => {
    void navigator.clipboard.writeText(text);
    window.open(`https://translate.google.com/?sl=auto&tl=${target}&op=translate`, '_blank', 'noopener');
    ctx.ui.toast('Đã sao chép văn bản — dán vào Google Dịch');
  };
  return (
    <Modal title="Dịch tài liệu" subtitle={`Dịch ${range ? 'đoạn đang chọn' : 'toàn bộ tài liệu'} (${text.length.toLocaleString('vi-VN')} ký tự)`} icon={<Languages size={20} />} onClose={onClose} width={760}
      actions={task.busy ? <button className="btn" onClick={task.stop}><Square size={13} /> Dừng</button> : <>{task.output.trim() && <button className="btn" title="Chèn bảng hai cột, bản gốc bên trái, bản dịch bên phải" onClick={() => { insertParallel(ctx, text, task.output, LANGUAGES.find((l) => l.code === target)?.label ?? target, range); onClose(); }}>Chèn song ngữ</button>}<ResultActions output={task.output} range={range} onDone={onClose} /></>}>
      <div className="ai-prompt">
        <select className="text-field" value={target} onChange={(e) => setTarget(e.target.value)}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        <button className="btn btn-primary" disabled={task.busy || !text.trim()} onClick={() => void task.start((onText, signal) => translateText(text, target, onText, signal))}>Dịch</button>
        <button className="btn" onClick={openGoogle}>Mở Google Dịch</button>
      </div>
      {task.error && <div className="form-error">{task.error}</div>}
      <div className="translate-panes">
        <textarea className="text-field" rows={12} readOnly value={text} />
        <textarea className="text-field" rows={12} value={task.busy && !task.output ? 'Đang dịch…' : task.output} onChange={(e) => task.setOutput(e.target.value)} placeholder="Bản dịch" />
      </div>
    </Modal>
  );
}
