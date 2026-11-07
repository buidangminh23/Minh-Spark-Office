import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { InkKind, InkStroke } from '../../../lib/storage';
import { newId, useDoc } from '../DocContext';
import { RULER_LENGTH, RULER_THICKNESS, boundsOfStrokes, eraseFromFlat, recognizeShape, rulerEdgeAt, snapToRuler, strokeHit, strokeInsidePolygon, strokeTouchesRect, translateFlat, type Point, type RulerState } from '../inkGeometry';
import { strokeMarkup } from '../inkRender';
import { deleteSelectedInk, commitInk, getPens, inkDefaults, pushInkHistory, redoInk, setInkSelection, undoInk, useInkStore } from '../inkStore';

const ERASE_RADIUS = 10;
const HIT_TOLERANCE = 6;
const CM_PX = 37.8;
const WHEEL_STEP = 5;
const FINE_WHEEL_STEP = 1;

type Gesture =
  | { type: 'draw'; pointerId: number; snapEdge: number | null }
  | { type: 'erase'; pointerId: number; snapshot: InkStroke[]; changed: boolean }
  | { type: 'lasso'; pointerId: number }
  | { type: 'marquee'; pointerId: number; start: Point }
  | { type: 'move'; pointerId: number; start: Point };

const StrokeView = memo(function StrokeView({ stroke, pageSpan }: { stroke: InkStroke; pageSpan: number }) {
  const markup = useMemo(() => strokeMarkup(stroke), [stroke]);
  return <g style={{ '--ink-page': pageSpan ? Math.floor((stroke.points[1] ?? 0) / pageSpan) : 0 } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: markup }} />;
});

function RulerOverlay({ ruler, onChange }: { ruler: RulerState; onChange: (next: RulerState) => void }) {
  const group = useRef<SVGGElement | null>(null);
  const latest = useRef({ ruler, onChange });
  latest.current = { ruler, onChange };
  const half = RULER_LENGTH / 2;
  const thick = RULER_THICKNESS / 2;
  const ticks = useMemo(() => {
    const out: { x: number; major: boolean; label: number | null }[] = [];
    const count = Math.floor(RULER_LENGTH / (CM_PX / 2));
    for (let i = 0; i <= count; i++) out.push({ x: -half + (i * CM_PX) / 2, major: i % 2 === 0, label: i % 2 === 0 ? i / 2 : null });
    return out;
  }, [half]);
  useEffect(() => {
    const element = group.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const step = (event.shiftKey ? FINE_WHEEL_STEP : WHEEL_STEP) * Math.sign(event.deltaY || 1);
      const current = latest.current.ruler;
      latest.current.onChange({ ...current, angle: (current.angle + step + 360) % 360 });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);
  const scale = () => {
    const svg = group.current?.ownerSVGElement;
    if (!svg) return { rect: new DOMRect(), factor: 1 };
    const rect = svg.getBoundingClientRect();
    return { rect, factor: svg.clientWidth ? rect.width / svg.clientWidth : 1 };
  };
  const startDrag = (event: React.PointerEvent<SVGRectElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const origin = { px: event.clientX, py: event.clientY, x: ruler.x, y: ruler.y };
    const { factor } = scale();
    const move = (e: PointerEvent) => latest.current.onChange({ ...latest.current.ruler, x: Math.round(origin.x + (e.clientX - origin.px) / factor), y: Math.round(origin.y + (e.clientY - origin.py) / factor) });
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  const startRotate = (event: React.PointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const { rect, factor } = scale();
      const current = latest.current.ruler;
      const centerX = rect.left + current.x * factor;
      const centerY = rect.top + current.y * factor;
      const angle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
      latest.current.onChange({ ...current, angle: Math.round((angle + 360) % 360) });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  return (
    <g ref={group} className="ink-ruler ink-ui" transform={`translate(${ruler.x} ${ruler.y}) rotate(${ruler.angle})`}>
      <rect className="ink-ruler-body" x={-half} y={-thick} width={RULER_LENGTH} height={RULER_THICKNESS} rx={3} onPointerDown={startDrag} />
      {ticks.map((tick) => (
        <g key={tick.x}>
          <line className="ink-ruler-tick" x1={tick.x} x2={tick.x} y1={-thick} y2={-thick + (tick.major ? 16 : 9)} />
          <line className="ink-ruler-tick" x1={tick.x} x2={tick.x} y1={thick} y2={thick - (tick.major ? 16 : 9)} />
          {tick.label !== null && <text className="ink-ruler-text" x={tick.x} y={-thick + 28} textAnchor="middle">{tick.label}</text>}
        </g>
      ))}
      <text className="ink-ruler-angle" x={0} y={8} textAnchor="middle">{`${Math.round(ruler.angle)}°`}</text>
      <circle className="ink-ruler-handle" cx={half - 20} cy={0} r={11} onPointerDown={startRotate}><title>Kéo để xoay thước, hoặc lăn chuột trên thước</title></circle>
    </g>
  );
}

const visibleForReplay = (strokes: InkStroke[], progress: number | null) => {
  if (progress === null) return strokes;
  const total = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  let budget = Math.floor(total * progress);
  const out: InkStroke[] = [];
  for (const stroke of strokes) {
    if (budget <= 0) break;
    if (budget >= stroke.points.length) out.push(stroke);
    else out.push({ ...stroke, points: stroke.points.slice(0, budget - (budget % 2)) });
    budget -= stroke.points.length;
  }
  return out.filter((stroke) => stroke.points.length >= 2);
};

export default function InkLayer({ pageSpan }: { pageSpan: number }) {
  const ctx = useDoc();
  const { page, setPage, view, setView, editor } = ctx;
  const { selected } = useInkStore(editor);
  const svg = useRef<SVGSVGElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const draftRef = useRef<InkStroke | null>(null);
  const [draft, setDraft] = useState<InkStroke | null>(null);
  const [lasso, setLasso] = useState<Point[] | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  const strokes = useMemo(() => page.ink ?? [], [page.ink]);
  const replaying = view.inkReplay !== null;
  const tool = replaying ? null : view.inkTool;
  const penOnly = view.inkInput === 'pen';
  const visible = Boolean(tool || strokes.length || view.inkRuler);

  const latest = useRef({ ctx, strokes, tool, view, lasso, marquee });
  latest.current = { ctx, strokes, tool, view, lasso, marquee };

  useEffect(() => {
    if (tool !== 'select' && tool !== 'lasso') setInkSelection(editor, []);
  }, [tool, editor]);

  useEffect(() => {
    if (!tool) return;
    const onKey = (event: KeyboardEvent) => {
      const current = latest.current;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const swallow = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      if ((event.key === 'Delete' || event.key === 'Backspace') && (current.tool === 'select' || current.tool === 'lasso')) {
        swallow();
        deleteSelectedInk(current.ctx);
        return;
      }
      if (mod && key === 'z' && !event.shiftKey) {
        swallow();
        undoInk(current.ctx);
        return;
      }
      if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
        swallow();
        redoInk(current.ctx);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tool]);

  useEffect(() => {
    const layer = svg.current;
    const paper = layer?.parentElement;
    if (!tool || !layer || !paper) return;
    const toPoint = (event: PointerEvent): Point => {
      const rect = layer.getBoundingClientRect();
      const factor = layer.clientWidth ? rect.width / layer.clientWidth : 1;
      return { x: Math.round((event.clientX - rect.left) / factor), y: Math.round((event.clientY - rect.top) / factor) };
    };
    const selectionBounds = () => boundsOfStrokes(latest.current.strokes.filter((stroke) => selected.has(stroke.id)));
    const insideSelection = (p: Point) => {
      const bounds = selectionBounds();
      return Boolean(bounds && p.x >= bounds.minX - HIT_TOLERANCE && p.x <= bounds.maxX + HIT_TOLERANCE && p.y >= bounds.minY - HIT_TOLERANCE && p.y <= bounds.maxY + HIT_TOLERANCE);
    };
    const eraseAt = (p: Point, current: Extract<Gesture, { type: 'erase' }>) => {
      const list = latest.current.strokes;
      const mode = latest.current.view.inkEraser;
      const next: InkStroke[] = [];
      let changed = false;
      for (const stroke of list) {
        if (mode === 'stroke') {
          if (strokeHit(stroke, p.x, p.y, ERASE_RADIUS)) changed = true;
          else next.push(stroke);
          continue;
        }
        const pieces = eraseFromFlat(stroke.points, p.x, p.y, ERASE_RADIUS + stroke.width / 2);
        if (!pieces) {
          next.push(stroke);
          continue;
        }
        changed = true;
        pieces.forEach((points) => next.push({ ...stroke, id: newId('ink'), points }));
      }
      if (!changed) return;
      current.changed = true;
      latest.current.strokes = next;
      setPage({ ink: next });
    };
    const startDraw = (event: PointerEvent, p: Point, snapEdge: number | null) => {
      const { view: viewState, tool: active } = latest.current;
      const preset = getPens().find((pen) => pen.id === viewState.penId);
      const kind: InkKind = preset?.kind ?? (active === 'highlighter' ? 'highlighter' : 'pen');
      const { opacity, widthFactor } = inkDefaults(kind);
      const first = snapEdge !== null && viewState.inkRuler ? snapToRuler(viewState.inkRuler, snapEdge, p.x, p.y) : p;
      gesture.current = { type: 'draw', pointerId: event.pointerId, snapEdge };
      draftRef.current = { id: newId('ink'), color: viewState.inkColor, width: viewState.inkWidth * widthFactor, opacity, kind, points: [Math.round(first.x * 10) / 10, Math.round(first.y * 10) / 10] };
      setDraft(draftRef.current);
    };
    const onDown = (event: PointerEvent) => {
      const active = latest.current.tool;
      if (!active || gesture.current) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (latest.current.view.inkInput === 'pen' && event.pointerType !== 'pen') return;
      const target = event.target as Element | null;
      const p = toPoint(event);
      const ruler = latest.current.view.inkRuler;
      const isDrawing = active === 'pen' || active === 'highlighter';
      const edge = ruler && isDrawing ? rulerEdgeAt(ruler, p.x, p.y) : null;
      if (target?.closest?.('.ink-ruler') && edge === null) return;
      event.preventDefault();
      event.stopPropagation();
      paper.setPointerCapture(event.pointerId);
      if (isDrawing) return startDraw(event, p, edge);
      if (active === 'eraser') {
        const eraseGesture: Extract<Gesture, { type: 'erase' }> = { type: 'erase', pointerId: event.pointerId, snapshot: latest.current.strokes, changed: false };
        gesture.current = eraseGesture;
        eraseAt(p, eraseGesture);
        return;
      }
      if (insideSelection(p) && !event.shiftKey) {
        gesture.current = { type: 'move', pointerId: event.pointerId, start: p };
        setOffset({ dx: 0, dy: 0 });
        return;
      }
      if (active === 'lasso') {
        setInkSelection(editor, []);
        gesture.current = { type: 'lasso', pointerId: event.pointerId };
        setLasso([p]);
        return;
      }
      const hit = [...latest.current.strokes].reverse().find((stroke) => strokeHit(stroke, p.x, p.y, HIT_TOLERANCE));
      if (hit) {
        const next = new Set(event.shiftKey ? selected : []);
        if (event.shiftKey && next.has(hit.id)) next.delete(hit.id);
        else next.add(hit.id);
        setInkSelection(editor, next);
        gesture.current = { type: 'move', pointerId: event.pointerId, start: p };
        setOffset({ dx: 0, dy: 0 });
        return;
      }
      if (!event.shiftKey) setInkSelection(editor, []);
      gesture.current = { type: 'marquee', pointerId: event.pointerId, start: p };
      setMarquee({ a: p, b: p });
    };
    const onMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const samples = event.getCoalescedEvents?.().length ? event.getCoalescedEvents() : [event];
      if (current.type === 'draw') {
        const ruler = latest.current.view.inkRuler;
        const extra: number[] = [];
        for (const sample of samples) {
          const raw = toPoint(sample);
          const p = current.snapEdge !== null && ruler ? snapToRuler(ruler, current.snapEdge, raw.x, raw.y) : raw;
          extra.push(Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10);
        }
        if (draftRef.current) {
          draftRef.current = { ...draftRef.current, points: [...draftRef.current.points, ...extra] };
          setDraft(draftRef.current);
        }
        return;
      }
      const p = toPoint(event);
      if (current.type === 'erase') eraseAt(p, current);
      else if (current.type === 'lasso') setLasso((list) => (list ? [...list, p] : list));
      else if (current.type === 'marquee') setMarquee({ a: current.start, b: p });
      else setOffset({ dx: p.x - current.start.x, dy: p.y - current.start.y });
    };
    const finish = (event: PointerEvent, cancelled: boolean) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      gesture.current = null;
      if (paper.hasPointerCapture(event.pointerId)) paper.releasePointerCapture(event.pointerId);
      const state = latest.current;
      if (current.type === 'draw') {
        const stroke = draftRef.current;
        draftRef.current = null;
        setDraft(null);
        if (cancelled || !stroke || stroke.points.length < 2) return;
        const shape = state.view.inkToShape && stroke.kind !== 'highlighter' ? recognizeShape(stroke.points) : null;
        const finished = shape ? { ...stroke, points: shape.points, shape: true } : stroke;
        commitInk(state.ctx, [...state.strokes, finished]);
        return;
      }
      if (current.type === 'erase') {
        if (current.changed) pushInkHistory(editor, current.snapshot);
        return;
      }
      if (current.type === 'lasso') {
        const polygon = state.lasso ?? [];
        setLasso(null);
        if (!cancelled) setInkSelection(editor, state.strokes.filter((stroke) => strokeInsidePolygon(stroke.points, polygon)).map((stroke) => stroke.id));
        return;
      }
      if (current.type === 'marquee') {
        const box = state.marquee;
        setMarquee(null);
        if (!cancelled && box) setInkSelection(editor, [...selected, ...state.strokes.filter((stroke) => strokeTouchesRect(stroke.points, box.a, box.b)).map((stroke) => stroke.id)]);
        return;
      }
      const end = toPoint(event);
      const moved = { dx: end.x - current.start.x, dy: end.y - current.start.y };
      setOffset(null);
      if (!cancelled && (moved.dx || moved.dy)) commitInk(state.ctx, state.strokes.map((stroke) => (selected.has(stroke.id) ? { ...stroke, points: translateFlat(stroke.points, moved.dx, moved.dy) } : stroke)));
    };
    const onUp = (event: PointerEvent) => finish(event, false);
    const onCancel = (event: PointerEvent) => finish(event, true);
    paper.addEventListener('pointerdown', onDown, true);
    paper.addEventListener('pointermove', onMove, true);
    paper.addEventListener('pointerup', onUp, true);
    paper.addEventListener('pointercancel', onCancel, true);
    return () => {
      paper.removeEventListener('pointerdown', onDown, true);
      paper.removeEventListener('pointermove', onMove, true);
      paper.removeEventListener('pointerup', onUp, true);
      paper.removeEventListener('pointercancel', onCancel, true);
    };
  }, [tool, editor, selected, setPage, visible]);

  const shown = useMemo(() => visibleForReplay(strokes, view.inkReplay), [strokes, view.inkReplay]);
  const selectedStrokes = useMemo(() => strokes.filter((stroke) => selected.has(stroke.id)), [strokes, selected]);
  const bounds = boundsOfStrokes(selectedStrokes);
  const moving = offset ?? { dx: 0, dy: 0 };
  if (!visible) return null;
  const classes = ['ink-layer', tool ? 'active' : '', tool ? `tool-${tool}` : '', penOnly ? 'pen-only' : ''].filter(Boolean).join(' ');
  return (
    <svg ref={svg} className={classes} aria-hidden={!tool}>
      {shown.filter((stroke) => !selected.has(stroke.id)).map((stroke) => <StrokeView key={stroke.id} stroke={stroke} pageSpan={pageSpan} />)}
      <g transform={`translate(${moving.dx} ${moving.dy})`}>
        {shown.filter((stroke) => selected.has(stroke.id)).map((stroke) => <StrokeView key={stroke.id} stroke={stroke} pageSpan={pageSpan} />)}
        {bounds && <rect className="ink-selection ink-ui" x={bounds.minX - 4} y={bounds.minY - 4} width={bounds.maxX - bounds.minX + 8} height={bounds.maxY - bounds.minY + 8} />}
      </g>
      {draft && <StrokeView stroke={draft} pageSpan={pageSpan} />}
      {lasso && lasso.length > 1 && <polygon className="ink-lasso ink-ui" points={lasso.map((p) => `${p.x},${p.y}`).join(' ')} />}
      {marquee && <rect className="ink-lasso ink-ui" x={Math.min(marquee.a.x, marquee.b.x)} y={Math.min(marquee.a.y, marquee.b.y)} width={Math.abs(marquee.b.x - marquee.a.x)} height={Math.abs(marquee.b.y - marquee.a.y)} />}
      {view.inkRuler && <RulerOverlay ruler={view.inkRuler} onChange={(inkRuler) => setView({ inkRuler })} />}
    </svg>
  );
}

