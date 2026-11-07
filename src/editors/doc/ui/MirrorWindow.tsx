import { useEffect, useState } from 'react';
import { Eye, Minus, Plus } from 'lucide-react';
import '../docEditor.css';
import './view.css';
import 'katex/dist/katex.min.css';

export type MirrorPayload = { html: string; css: string; title: string; width: number; fontFamily?: string; fontSize?: number; padding: string };

export default function MirrorWindow({ channel }: { channel: string }) {
  const [payload, setPayload] = useState<MirrorPayload | null>(null);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    const bus = new BroadcastChannel(`minh-docs-mirror-${channel}`);
    bus.onmessage = (event: MessageEvent<MirrorPayload | 'closed'>) => {
      if (event.data === 'closed') window.close();
      else setPayload(event.data);
    };
    bus.postMessage('ready');
    return () => bus.close();
  }, [channel]);
  useEffect(() => {
    if (payload) document.title = `${payload.title} (cửa sổ phụ)`;
  }, [payload]);
  return (
    <div className="mirror-window doc-editor">
      {payload && <style>{payload.css}</style>}
      <header className="mirror-bar">
        <Eye size={15} />
        <strong>{payload?.title ?? 'Đang kết nối với tài liệu…'}</strong>
        <span>Cửa sổ phụ, chỉ đọc, tự cập nhật theo bản đang sửa</span>
        <span className="spacer" />
        <button className="icon-btn" aria-label="Thu nhỏ" onClick={() => setZoom((value) => Math.max(50, value - 10))}><Minus size={14} /></button>
        <span>{zoom}%</span>
        <button className="icon-btn" aria-label="Phóng to" onClick={() => setZoom((value) => Math.min(200, value + 10))}><Plus size={14} /></button>
      </header>
      <main className="mirror-scroll">
        {payload ? (
          <div className="paper-zoom" style={{ zoom: zoom / 100 }}>
            <div className="doc-paper mirror-paper" style={{ width: payload.width, padding: payload.padding, fontFamily: payload.fontFamily ? `"${payload.fontFamily}", Arial, sans-serif` : undefined, fontSize: payload.fontSize ? `${payload.fontSize}pt` : undefined }}>
              <div className="tiptap" dangerouslySetInnerHTML={{ __html: payload.html }} />
            </div>
          </div>
        ) : <div className="mirror-empty">Giữ cửa sổ tài liệu chính đang mở để xem nội dung tại đây.</div>}
      </main>
    </div>
  );
}
