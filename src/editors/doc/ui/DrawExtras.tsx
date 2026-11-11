import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Eraser, Pause, Play, Sigma, Undo2, X } from 'lucide-react';
import katex from 'katex';
import { getApiKey, loadClaude } from '../ai';
import { useDoc, type DialogId } from '../DocContext';
import Modal from './Modal';

const VISION_MODEL = 'claude-opus-5-5';
const VISION_PROMPT = 'The image shows a handwritten mathematical expression. Reply with only the LaTeX source for that expression, with no dollar signs, no code fences and no explanation. If the image contains no mathematical expression, reply with exactly NONE.';
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 240;
const MIN_REPLAY_MS = 2000;
const MAX_REPLAY_MS = 20000;
const MS_PER_POINT = 6;
const FRAME_MS = 33;

const cleanLatex = (raw: string) => raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').replace(/^\$+|\$+$/g, '').trim();

async function recognizeMath(dataUrl: string, signal: AbortSignal) {
  const Anthropic = await loadClaude();
  const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
  const message = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: dataUrl.split(',')[1] } }, { type: 'text', text: VISION_PROMPT }] }],
  }, { signal });
  return cleanLatex(message.content.map((block) => (block.type === 'text' ? block.text : '')).join(''));
}

const visionError = async (error: unknown) => {
  const Anthropic = await loadClaude();
  if (error instanceof Anthropic.AuthenticationError) return 'API key Claude không hợp lệ. Mở Minh AI, phần Cài đặt để nhập lại.';
  if (error instanceof Anthropic.RateLimitError) return 'Claude đang giới hạn tốc độ, thử lại sau ít phút.';
  if (error instanceof Anthropic.APIConnectionError) return 'Không kết nối được tới Claude. Kiểm tra mạng rồi thử lại.';
  if (error instanceof Anthropic.APIError) return `Claude báo lỗi ${error.status ?? ''}: ${error.message}`;
  return (error as Error).message || 'Không nhận dạng được công thức';
};

function InkMathDialog({ onClose }: { onClose: () => void }) {
  const { editor, ui } = useDoc();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const preview = useRef<HTMLDivElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [latex, setLatex] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasKey = Boolean(getApiKey());

  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.strokeStyle = '#111827';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const stroke of strokes) {
      c.beginPath();
      for (let i = 0; i + 1 < stroke.length; i += 2) {
        if (i) c.lineTo(stroke[i], stroke[i + 1]);
        else c.moveTo(stroke[i], stroke[i + 1]);
      }
      if (stroke.length === 2) c.lineTo(stroke[0], stroke[1]);
      c.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    if (preview.current) katex.render(latex || '\\square', preview.current, { throwOnError: false, displayMode: true });
  }, [latex]);

  useEffect(() => () => abort.current?.abort(), []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.round(((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH), Math.round(((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT)];
  };
  const recognize = async () => {
    const element = canvas.current;
    if (!element || !strokes.length) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    setError('');
    try {
      const result = await recognizeMath(element.toDataURL('image/png'), abort.current.signal);
      if (!result || result === 'NONE') setError('Không thấy công thức nào trong hình. Viết rõ hơn rồi thử lại.');
      else setLatex(result);
    } catch (failure) {
      if (!abort.current.signal.aborted) setError(await visionError(failure));
    } finally {
      setBusy(false);
    }
  };
  const insert = () => {
    editor.chain().focus().insertEquation(latex, true).run();
    ui.toast('Đã chèn công thức');
    onClose();
  };
  return (
    <Modal title="Viết tay thành công thức" subtitle="Viết công thức vào khung, bấm Nhận dạng rồi kiểm tra LaTeX trước khi chèn." icon={<Sigma size={20} />} onClose={onClose} width={780} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={!latex.trim()} onClick={insert}>Chèn công thức</button></>}>
      <canvas
        ref={canvas}
        className="ink-math-canvas"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Khung viết tay công thức"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setStrokes((list) => [...list, point(e)]); }}
        onPointerMove={(e) => { if (!(e.buttons & 1)) return; const p = point(e); setStrokes((list) => (list.length ? [...list.slice(0, -1), [...list[list.length - 1], ...p]] : list)); }}
      />
      <div className="ink-math-actions">
        <button className="btn" disabled={!strokes.length} onClick={() => setStrokes((list) => list.slice(0, -1))}><Undo2 size={14} /> Bỏ nét cuối</button>
        <button className="btn" disabled={!strokes.length} onClick={() => setStrokes([])}><Eraser size={14} /> Xoá khung</button>
        <span className="spacer" />
        <button className="btn btn-primary" disabled={!hasKey || !strokes.length || busy} onClick={() => void recognize()}>{busy ? 'Đang nhận dạng…' : 'Nhận dạng'}</button>
      </div>
      {!hasKey && <p className="ink-math-note">Nhận dạng chữ viết tay cần API key Claude. Mở Minh AI, phần Cài đặt để nhập key. Chưa có key thì gõ LaTeX trực tiếp vào ô dưới, phần xem trước vẫn chạy.</p>}
      {error && <p className="ink-math-note error" role="alert">{error}</p>}
      <label className="field"><span className="field-label">LaTeX</span><textarea className="text-field mono" rows={2} value={latex} placeholder="\frac{a+b}{2}" onChange={(e) => setLatex(e.target.value)} /></label>
      <div className="equation-preview" ref={preview} />
    </Modal>
  );
}

function InkHelpDialog({ onClose }: { onClose: () => void }) {
  const items: [string, string][] = [
    ['Vẽ', 'Bấm Vẽ hoặc chọn một cây bút. Bấm Vẽ lần nữa hoặc nhấn Esc để quay lại soạn thảo.'],
    ['Chỉ bút cảm ứng', 'Khi bật, chuột và tay vẫn chọn chữ và cuộn trang, chỉ bút cảm ứng mới để lại nét.'],
    ['Đổi bút', 'Bấm lại cây bút đang dùng để đổi màu và độ dày. Nút Thêm tạo bút mới, bộ bút được nhớ trên máy này.'],
    ['Chọn nét', 'Công cụ mũi tên chọn từng nét hoặc kéo khung, giữ Shift để chọn thêm. Công cụ khoanh vùng chọn các nét nằm trong vùng khoanh. Kéo để dời, Delete để xoá.'],
    ['Tẩy', 'Bấm lại nút Tẩy để chuyển giữa tẩy cả nét và tẩy từng điểm.'],
    ['Thước', 'Kéo để dời, lăn chuột hoặc kéo nút tròn để xoay. Bắt đầu nét sát mép thước thì nét sẽ thẳng theo mép.'],
    ['Thành hình', 'Khi bật, nét vừa vẽ tự thành đường thẳng, chữ nhật, elip, tam giác hoặc mũi tên nếu nhận ra hình.'],
    ['Thành công thức', 'Viết tay rồi nhận dạng bằng Claude, hoặc gõ LaTeX trực tiếp.'],
    ['Phát lại nét', 'Xem lại thứ tự các nét đã vẽ, có nút dừng và thanh kéo.'],
    ['In và xuất', 'Nét vẽ được in cùng trang. Khi xuất tệp, hãy dùng Chuyển thành ảnh để nét đi theo nội dung.'],
    ['Phím tắt', 'Ctrl+Z hoàn tác nét, Ctrl+Y làm lại nét, Delete xoá nét đã chọn, Esc thoát chế độ vẽ.'],
  ];
  return (
    <Modal title="Hướng dẫn công cụ vẽ" icon={<CircleHelp size={20} />} onClose={onClose} width={620} actions={<button className="btn btn-primary" onClick={onClose}>Đóng</button>}>
      <dl className="ink-help-list">
        {items.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}
      </dl>
    </Modal>
  );
}

function ReplayBar() {
  const { view, setView, page } = useDoc();
  const [playing, setPlaying] = useState(true);
  const progress = view.inkReplay ?? 0;
  const latest = useRef({ progress, setView });
  latest.current = { progress, setView };
  const totalPoints = (page.ink ?? []).reduce((sum, stroke) => sum + stroke.points.length / 2, 0);
  const duration = Math.min(MAX_REPLAY_MS, Math.max(MIN_REPLAY_MS, totalPoints * MS_PER_POINT));
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    let lastPublish = previous;
    let value = latest.current.progress >= 1 ? 0 : latest.current.progress;
    const tick = (now: number) => {
      value = Math.min(1, value + (now - previous) / duration);
      previous = now;
      if (now - lastPublish >= FRAME_MS || value >= 1) {
        lastPublish = now;
        latest.current.setView({ inkReplay: value });
      }
      if (value >= 1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);
  return (
    <div className="ink-replay-bar" role="region" aria-label="Phát lại nét vẽ">
      <button className="icon-btn" aria-label={playing ? 'Tạm dừng' : 'Phát'} title={playing ? 'Tạm dừng' : 'Phát'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
      <input type="range" min={0} max={1000} value={Math.round(progress * 1000)} aria-label="Tiến trình phát lại" onChange={(e) => { setPlaying(false); setView({ inkReplay: Number(e.target.value) / 1000 }); }} />
      <span className="ink-replay-value">{Math.round(progress * 100)}%</span>
      <button className="icon-btn" aria-label="Đóng phát lại" title="Đóng" onClick={() => setView({ inkReplay: null })}><X size={16} /></button>
    </div>
  );
}

export default function DrawExtras({ dialog, onClose }: { dialog: DialogId | null; onClose: () => void }) {
  const { view } = useDoc();
  return (
    <>
      {dialog === 'inkmath' && <InkMathDialog onClose={onClose} />}
      {dialog === 'inkhelp' && <InkHelpDialog onClose={onClose} />}
      {view.inkReplay !== null && <ReplayBar />}
    </>
  );
}
