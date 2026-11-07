import { useRef, useState } from 'react';
import type { InkStroke } from '../../../lib/storage';
import { newId, useDoc } from '../DocContext';

const ERASE_RADIUS = 10;

const pathOf = (points: number[]) => {
  if (points.length < 2) return '';
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) d += ` L${points[i]} ${points[i + 1]}`;
  return d;
};

const hits = (stroke: InkStroke, x: number, y: number) => {
  for (let i = 0; i < stroke.points.length; i += 2) {
    if (Math.hypot(stroke.points[i] - x, stroke.points[i + 1] - y) <= ERASE_RADIUS + stroke.width / 2) return true;
  }
  return false;
};

export default function InkLayer({ pageSpan }: { pageSpan: number }) {
  const { page, setPage, view } = useDoc();
  const svg = useRef<SVGSVGElement | null>(null);
  const [draft, setDraft] = useState<InkStroke | null>(null);
  const strokes = page.ink ?? [];
  const tool = view.inkTool;
  if (!tool && !strokes.length) return null;
  const point = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const scale = view.zoom / 100;
    return { x: Math.round((e.clientX - rect.left) / scale), y: Math.round((e.clientY - rect.top) / scale) };
  };
  const erase = (x: number, y: number) => {
    const left = strokes.filter((s) => !hits(s, x, y));
    if (left.length !== strokes.length) setPage({ ink: left });
  };
  return (
    <svg ref={svg} className={`ink-layer ${tool ? 'active' : ''}`} aria-hidden={!tool}
      onPointerDown={(e) => {
        if (!tool) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const { x, y } = point(e);
        if (tool === 'eraser') return erase(x, y);
        setDraft({ id: newId('ink'), color: view.inkColor, width: tool === 'highlighter' ? view.inkWidth * 4 : view.inkWidth, opacity: tool === 'highlighter' ? 0.35 : 1, points: [x, y] });
      }}
      onPointerMove={(e) => {
        if (!tool || !(e.buttons & 1)) return;
        const { x, y } = point(e);
        if (tool === 'eraser') return erase(x, y);
        setDraft((d) => (d ? { ...d, points: [...d.points, x, y] } : d));
      }}
      onPointerUp={() => {
        if (draft && draft.points.length >= 2) setPage({ ink: [...strokes, draft] });
        setDraft(null);
      }}>
      {[...strokes, ...(draft ? [draft] : [])].map((s) => (
        <path key={s.id} d={pathOf(s.points)} style={{ '--ink-page': pageSpan ? Math.floor((s.points[1] ?? 0) / pageSpan) : 0 } as React.CSSProperties} fill="none" stroke={s.color} strokeWidth={s.width} strokeOpacity={s.opacity} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
