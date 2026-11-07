import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useEditorState } from '@tiptap/react';
import { useDoc } from '../DocContext';

const CM = 37.8;
const MIN_TEXT_WIDTH = 160;

const cmLabel = (px: number) => `${(px / CM).toFixed(2).replace('.', ',')} cm`;

type DragState = { startPos: number; startValue: number; apply: (value: number) => void; min: number; max: number; axis: 'x' | 'y'; guide: (value: number) => number; inverted?: boolean };

function useRulerDrag(zoom: number) {
  const drag = useRef<DragState | null>(null);
  const [tip, setTip] = useState<{ at: number; text: string; axis: 'x' | 'y' } | null>(null);
  const begin = (event: ReactPointerEvent, state: DragState, label: (value: number) => string) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    drag.current = state;
    const move = (e: PointerEvent) => {
      const current = drag.current;
      if (!current) return;
      const delta = (((current.axis === 'x' ? e.clientX : e.clientY) - current.startPos) / zoom) * (current.inverted ? -1 : 1);
      const value = Math.round(Math.max(current.min, Math.min(current.max, current.startValue + delta)));
      current.apply(value);
      setTip({ at: current.guide(value), text: label(value), axis: current.axis });
    };
    const up = () => {
      drag.current = null;
      setTip(null);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  return { begin, tip };
}

export function HorizontalRuler({ width }: { width: number }) {
  const { page, setPage, editor, view } = useDoc();
  const zoom = view.zoom / 100;
  const { begin, tip } = useRulerDrag(zoom);
  const indents = useEditorState({ editor, selector: ({ editor: e }) => {
    const attrs = e.getAttributes(e.isActive('heading') ? 'heading' : 'paragraph');
    return { left: (Number(attrs.indent) || 0) * 48, right: Number(attrs.indentRight) || 0, first: Number(attrs.firstLine) || 0 };
  } });
  const { left, right } = page.margins;
  const contentEnd = width - right;
  const ticks = Math.floor(width / (CM / 2));
  return (
    <div className="doc-ruler" style={{ width }}>
      <div className="ruler-margin" style={{ width: left }} />
      <div className="ruler-margin right" style={{ width: right }} />
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const x = (i * CM) / 2;
        const cm = Math.round((x - left) / CM);
        const major = i % 2 === Math.round(left / (CM / 2)) % 2;
        return <div key={i} className={`ruler-tick ${major ? '' : 'half'}`} style={{ left: x }}>{major && cm !== 0 ? Math.abs(cm) : ''}</div>;
      })}
      <button type="button" className="ruler-handle margin" style={{ left: left - 4 }} title="Kéo để đổi lề trái" aria-label="Lề trái" onPointerDown={(e) => begin(e, { startPos: e.clientX, startValue: left, axis: 'x', min: 0, max: width - right - MIN_TEXT_WIDTH, apply: (v) => setPage({ margins: { ...page.margins, left: v } }), guide: (v) => v }, cmLabel)} />
      <button type="button" className="ruler-handle margin" style={{ left: contentEnd - 4 }} title="Kéo để đổi lề phải" aria-label="Lề phải" onPointerDown={(e) => begin(e, { startPos: e.clientX, startValue: right, inverted: true, axis: 'x', min: 0, max: width - left - MIN_TEXT_WIDTH, apply: (v) => setPage({ margins: { ...page.margins, right: v } }), guide: (v) => width - v }, cmLabel)} />
      <button type="button" className="ruler-marker first" style={{ left: left + indents.left + indents.first - 5 }} title="Thụt dòng đầu" aria-label="Thụt dòng đầu" onPointerDown={(e) => begin(e, { startPos: e.clientX, startValue: indents.first, axis: 'x', min: -indents.left, max: contentEnd - left - indents.left - 40, apply: (v) => editor.commands.setParagraphIndent({ firstLine: v }), guide: (v) => left + indents.left + v }, cmLabel)} />
      <button type="button" className="ruler-marker hanging" style={{ left: left + indents.left - 5 }} title="Thụt lề trái" aria-label="Thụt lề trái" onPointerDown={(e) => begin(e, { startPos: e.clientX, startValue: indents.left, axis: 'x', min: 0, max: contentEnd - left - 40, apply: (v) => editor.commands.setParagraphIndent({ left: v }), guide: (v) => left + v }, cmLabel)} />
      <button type="button" className="ruler-marker right-indent" style={{ left: contentEnd - indents.right - 5 }} title="Thụt lề phải" aria-label="Thụt lề phải" onPointerDown={(e) => begin(e, { startPos: e.clientX, startValue: indents.right, inverted: true, axis: 'x', min: 0, max: contentEnd - left - 40, apply: (v) => editor.commands.setParagraphIndent({ right: v }), guide: (v) => contentEnd - v }, cmLabel)} />
      {tip && tip.axis === 'x' && <div className="ruler-tip" style={{ left: tip.at }}>{tip.text}</div>}
      {tip && tip.axis === 'x' && <div className="ruler-guide" style={{ left: tip.at }} />}
    </div>
  );
}

export function VerticalRuler({ height, top: offset }: { height: number; top: number }) {
  const { page, setPage, view } = useDoc();
  const zoom = view.zoom / 100;
  const { begin, tip } = useRulerDrag(zoom);
  const { top, bottom } = page.margins;
  const ticks = Math.floor(height / (CM / 2));
  return (
    <div className="doc-ruler-v" style={{ height, top: offset }}>
      <div className="ruler-margin-v" style={{ height: top }} />
      <div className="ruler-margin-v bottom" style={{ height: bottom }} />
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const y = (i * CM) / 2;
        const cm = Math.round((y - top) / CM);
        const major = i % 2 === Math.round(top / (CM / 2)) % 2;
        return <div key={i} className={`ruler-tick-v ${major ? '' : 'half'}`} style={{ top: y }}>{major && cm !== 0 ? <span>{Math.abs(cm)}</span> : null}</div>;
      })}
      <button type="button" className="ruler-handle-v" style={{ top: top - 4 }} title="Kéo để đổi lề trên" aria-label="Lề trên" onPointerDown={(e) => begin(e, { startPos: e.clientY, startValue: top, axis: 'y', min: 0, max: height - bottom - MIN_TEXT_WIDTH, apply: (v) => setPage({ margins: { ...page.margins, top: v } }), guide: (v) => v }, cmLabel)} />
      <button type="button" className="ruler-handle-v" style={{ top: height - bottom - 4 }} title="Kéo để đổi lề dưới" aria-label="Lề dưới" onPointerDown={(e) => begin(e, { startPos: e.clientY, startValue: bottom, inverted: true, axis: 'y', min: 0, max: height - top - MIN_TEXT_WIDTH, apply: (v) => setPage({ margins: { ...page.margins, bottom: v } }), guide: (v) => height - v }, cmLabel)} />
      {tip && tip.axis === 'y' && <div className="ruler-tip vertical" style={{ top: tip.at }}>{tip.text}</div>}
    </div>
  );
}
