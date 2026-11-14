import { useRef, useState } from 'react';
import type { EditablePdfPage } from '../../lib/pdfOcrTypes';

type Props = { page: EditablePdfPage; zoom: number; rotation: number; onEdit: (pageIndex: number, id: string, text: string) => Promise<void> };

export function PdfOcrTextLayer({ page, zoom, rotation, onEdit }: Props) {
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const turn = ((rotation % 360) + 360) % 360;
  const transform = turn === 90 ? `translate(${page.height}px, 0) rotate(90deg)` : turn === 180 ? `translate(${page.width}px, ${page.height}px) rotate(180deg)` : turn === 270 ? `translate(0, ${page.width}px) rotate(270deg)` : '';
  const commit = async () => {
    if (!editing || savingRef.current) return;
    const line = page.lines.find((item) => item.id === editing.id);
    if (!line || line.text === editing.text) { setEditing(null); return; }
    setSaving(true);
    savingRef.current = true;
    try { await onEdit(page.pageIndex, editing.id, editing.text); setEditing(null); }
    catch { setSaving(false); }
    finally { savingRef.current = false; }
  };
  return <div className="pdf-ocr-text-layer" style={{ width: page.width, height: page.height, transform: `scale(${zoom / 100}) ${transform}`, transformOrigin: '0 0' }}>
    {page.lines.map((line) => editing?.id === line.id
      ? <input key={line.id} className="pdf-ocr-text-input" autoFocus value={editing.text} disabled={saving} maxLength={2000} aria-label="Nội dung chữ PDF" title="Enter để lưu, Esc để hủy" style={{ left: line.x, top: line.y - 2, width: Math.max(line.width, 32), height: Math.max(line.height + 4, 18), fontSize: line.fontSize, fontFamily: line.fontFamily === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif', fontWeight: line.bold ? 700 : 400 }} onFocus={(event) => event.target.select()} onChange={(event) => setEditing({ id: line.id, text: event.target.value })} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void commit(); }
        if (event.key === 'Escape') { event.preventDefault(); setEditing(null); }
      }} onBlur={() => { void commit(); }} />
      : <button key={line.id} type="button" className="pdf-ocr-text-hit" disabled={saving || editing !== null} aria-label={`Sửa chữ: ${line.text}`} title={line.text || 'Vùng chữ trống'} style={{ left: line.x, top: line.y, width: Math.max(line.width, 8), height: Math.max(line.height, 8) }} onClick={() => { setSaving(false); setEditing({ id: line.id, text: line.text }); }} />)}
  </div>;
}
