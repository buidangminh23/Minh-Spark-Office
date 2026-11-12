import type { SlideAspect } from '../../lib/slideTypes';
import { useRef, useState, useEffect, type ReactNode } from 'react';
import { Lock, Sheet, Copy, ZoomIn, Cuboid, Clapperboard, Pause, Play, RotateCcw, ChartNoAxesColumn } from 'lucide-react';
import type { SlideData, SlideElement } from '../../lib/slideTypes';
import { collectSlideAnimations, type MorphGeometry } from '../../lib/slideEffects';
import { boundsOf, elementsInRect, expandSelection, moveBoxes, type Box, type ElementPatch } from '../../lib/slideArrange';
import { isLineShape } from '../../lib/slideShapes';
import { ShapeSvg } from './SlideShapeSvg';
import { ToneDot } from './slideIcons';
import { isEditableKeyTarget } from './slideKeyTarget';
import { getSettings } from '../../lib/appSettings';
import { gridStepPercent, slideBaseWidth, snapPosition, snapResize } from '../../lib/settings/slideOptions';
import { AudioElementView, CameoElementView, IconElementView, LinkBadge, ObjectElementView, RichTextLines, imageEffectStyle, textDecorationOf, textEffectStyle } from './SlideElementExtras';

interface SlideCanvasProps {
  slide: SlideData;
  aspectRatio: SlideAspect;
  zoom: number;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onDeleteElement?: (id: string) => void;
  selectedElementIds?: string[];
  onSelectElements?: (ids: string[], primaryId: string | null) => void;
  onUpdateElements?: (patch: ElementPatch) => void;
  onDeleteElements?: (ids: string[]) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  readOnly?: boolean;
  showGridlines?: boolean;
  showGuides?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  smartGuides?: boolean;
  drawMode?: 'select' | 'pen' | 'highlighter' | 'eraser';
  inkColor?: string;
  inkWidth?: number;
  onAddInkElement?: (el: Partial<SlideElement>) => void;
  onContextMenu?: (e: React.MouseEvent, elementId: string | null) => void;
  geometryOverrides?: Record<string, MorphGeometry>;
  geometryTransitionSec?: number;
  showAnimBadges?: boolean;
  hiddenElementIds?: string[];
  watermark?: {
    text: string;
    enabled: boolean;
    opacity?: number;
  };
  slideMaster?: {
    enabled: boolean;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
    showSlideNumber?: boolean;
    dateText?: string;
  };
  slideIndex?: number;
  presenting?: boolean;
  remotePeers?: RemoteSlidePeer[];
}

export type RemoteSlidePeer = { key: string; name: string; color: string; ids: string[] };

export function SlideCanvas({
  slide,
  aspectRatio,
  zoom,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  selectedElementIds,
  onSelectElements,
  onUpdateElements,
  onDeleteElements,
  onInteractionStart,
  onInteractionEnd,
  readOnly = false,
  showGridlines = false,
  showGuides = false,
  snapToGrid = false,
  gridSize = 20,
  smartGuides = true,
  drawMode = 'select',
  inkColor = '#000000',
  inkWidth = 3,
  onAddInkElement,
  onContextMenu,
  geometryOverrides,
  geometryTransitionSec = 0,
  showAnimBadges = true,
  hiddenElementIds = [],
  watermark,
  slideMaster,
  slideIndex = 0,
  presenting = false,
  remotePeers = [],
}: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resizingHandle, setResizingHandle] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    elX: number;
    elY: number;
    elW: number;
    elH: number;
    rotation?: number;
  } | null>(null);

  // Freehand drawing live points
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentInkPoints, setCurrentInkPoints] = useState<number[]>([]);
  const [snapGuideX, setSnapGuideX] = useState<number | null>(null);
  const [snapGuideY, setSnapGuideY] = useState<number | null>(null);
  const [snapDistanceBadge, setSnapDistanceBadge] = useState<{ x: number; y: number; text: string } | null>(null);

  const [dragOrigins, setDragOrigins] = useState<Record<string, Box>>({});
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const selectedElement = slide.elements.find((el) => el.id === selectedElementId);
  const selectedIds = selectedElementIds ?? (selectedElementId ? [selectedElementId] : []);
  const isMultiSelection = selectedIds.length > 1;

  const selectMany = (ids: string[], primaryId: string | null) => {
    if (onSelectElements) onSelectElements(ids, primaryId);
    else onSelectElement(primaryId);
  };

  const applyPatch = (patch: ElementPatch) => {
    if (onUpdateElements) {
      onUpdateElements(patch);
      return;
    }
    for (const id of Object.keys(patch)) onUpdateElement(id, patch[id]);
  };

  const pointerPercent = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  // Background style computation
  const backgroundStyle: React.CSSProperties = {
    background: slide.background.value || '#FFFFFF',
    transform: `scale(${zoom / 100})`,
    transformOrigin: 'center center',
  };

  // Pointer Down on Element
  const handlePointerDown = (e: React.PointerEvent, el: SlideElement) => {
    if (readOnly) return;

    if (drawMode === 'eraser') {
      e.stopPropagation();
      if (el.type === 'ink') {
        onDeleteElement?.(el.id);
      }
      return;
    }

    if (drawMode !== 'select') return; // In draw mode, canvas handles it

    e.stopPropagation();
    const members = expandSelection(slide.elements, [el.id]);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    let nextIds: string[];
    if (additive) {
      const already = selectedIds.includes(el.id);
      nextIds = already
        ? selectedIds.filter((id) => !members.includes(id))
        : [...selectedIds, ...members.filter((id) => !selectedIds.includes(id))];
      selectMany(nextIds, already ? nextIds[nextIds.length - 1] ?? null : el.id);
      if (already) return;
    } else if (selectedIds.includes(el.id)) {
      nextIds = selectedIds;
      if (selectedElementId !== el.id) selectMany(nextIds, el.id);
    } else {
      nextIds = members;
      selectMany(nextIds, el.id);
    }

    if (el.locked) return; // Prevent drag if element is locked

    if (editingTextId === el.id) return;

    const container = containerRef.current;
    if (!container) return;

    const origins: Record<string, Box> = {};
    for (const item of slide.elements) {
      if (nextIds.includes(item.id) && !item.locked) {
        origins[item.id] = { x: item.x, y: item.y, width: item.width, height: item.height };
      }
    }
    setDragOrigins(origins);
    onInteractionStart?.();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      elX: el.x,
      elY: el.y,
      elW: el.width,
      elH: el.height,
    });
  };

  // Pointer Down on Resize Handle
  const handleHandlePointerDown = (e: React.PointerEvent, handle: string) => {
    if (readOnly || !selectedElement) return;
    e.stopPropagation();
    onInteractionStart?.();
    setResizingHandle(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      elX: selectedElement.x,
      elY: selectedElement.y,
      elW: selectedElement.width,
      elH: selectedElement.height,
    });
  };

  // Pointer Down on Rotate Handle
  const handleRotatePointerDown = (e: React.PointerEvent) => {
    if (readOnly || !selectedElement) return;
    e.stopPropagation();
    onInteractionStart?.();
    setIsRotating(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      elX: selectedElement.x,
      elY: selectedElement.y,
      elW: selectedElement.width,
      elH: selectedElement.height,
      rotation: selectedElement.rotation || 0,
    });
  };

  // Canvas Drawing Pointer Down
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (drawMode === 'pen' || drawMode === 'highlighter') {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ptX = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
      const ptY = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;

      setIsDrawing(true);
      setCurrentInkPoints([ptX, ptY]);
      return;
    }
    if (drawMode === 'select' && e.button === 0 && !editingTextId) {
      const point = pointerPercent(e.clientX, e.clientY);
      setMarquee({ startX: point.x, startY: point.y, x: point.x, y: point.y });
    }
  };

  // Drag, Resize & Rotation window listeners
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      // Freehand drawing in progress
      if (isDrawing && (drawMode === 'pen' || drawMode === 'highlighter')) {
        const ptX = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
        const ptY = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;
        setCurrentInkPoints((prev) => [...prev, ptX, ptY]);
        return;
      }

      if (marquee) {
        const point = {
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
        };
        setMarquee((current) => (current ? { ...current, x: point.x, y: point.y } : current));
        return;
      }

      if (!dragStart || !selectedElement) return;

      const deltaXPct = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragStart.y) / rect.height) * 100;
      const gridStep = snapToGrid && !e.altKey ? gridStepPercent(gridSize, aspectRatio) : null;

      if (isDragging && Object.keys(dragOrigins).length > 1) {
        const anchor = dragOrigins[selectedElement.id];
        const snapped = gridStep && anchor ? snapPosition(anchor.x + deltaXPct, anchor.y + deltaYPct, anchor, gridStep) : null;
        applyPatch(moveBoxes(dragOrigins, snapped ? snapped.x - anchor.x : deltaXPct, snapped ? snapped.y - anchor.y : deltaYPct));
      } else if (isDragging) {
        let newX = Math.max(0, Math.min(100 - selectedElement.width, dragStart.elX + deltaXPct));
        let newY = Math.max(0, Math.min(100 - selectedElement.height, dragStart.elY + deltaYPct));
        if (gridStep) ({ x: newX, y: newY } = snapPosition(newX, newY, selectedElement, gridStep));

        // Smart Magnetic Guides & Snapping
        const centerX = newX + selectedElement.width / 2;
        const centerY = newY + selectedElement.height / 2;
        let snapX: number | null = null;
        let snapY: number | null = null;
        let badge: { x: number; y: number; text: string } | null = null;

        // Snap to slide center (50%)
        if (smartGuides && Math.abs(centerX - 50) < 1.5) {
          newX = 50 - selectedElement.width / 2;
          snapX = 50;
          badge = { x: 50, y: Math.max(5, newY - 4), text: '⟷ 16px Căn Giữa ⟷' };
        }
        if (smartGuides && Math.abs(centerY - 50) < 1.5) {
          newY = 50 - selectedElement.height / 2;
          snapY = 50;
          badge = { x: Math.max(10, newX + selectedElement.width / 2), y: 50, text: '↕ 16px Căn Giữa ↕' };
        }

        setSnapGuideX(snapX);
        setSnapGuideY(snapY);
        setSnapDistanceBadge(badge);

        onUpdateElement(selectedElement.id, {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
        });
      } else if (resizingHandle) {
        let newX = dragStart.elX;
        let newY = dragStart.elY;
        let newW = dragStart.elW;
        let newH = dragStart.elH;

        if (resizingHandle.includes('e')) newW = Math.max(5, dragStart.elW + deltaXPct);
        if (resizingHandle.includes('s')) newH = Math.max(5, dragStart.elH + deltaYPct);
        if (resizingHandle.includes('w')) {
          const possibleW = dragStart.elW - deltaXPct;
          if (possibleW >= 5) {
            newX = dragStart.elX + deltaXPct;
            newW = possibleW;
          }
        }
        if (resizingHandle.includes('n')) {
          const possibleH = dragStart.elH - deltaYPct;
          if (possibleH >= 5) {
            newY = dragStart.elY + deltaYPct;
            newH = possibleH;
          }
        }

        if (gridStep) ({ x: newX, y: newY, width: newW, height: newH } = snapResize({ x: newX, y: newY, width: newW, height: newH }, resizingHandle, gridStep));

        onUpdateElement(selectedElement.id, {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
        });
      } else if (isRotating) {
        // Calculate angle relative to element center
        const centerX = rect.left + ((dragStart.elX + dragStart.elW / 2) / 100) * rect.width;
        const centerY = rect.top + ((dragStart.elY + dragStart.elH / 2) / 100) * rect.height;
        const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let deg = Math.round((rad * (180 / Math.PI)) + 90);
        if (deg < 0) deg += 360;
        // Snap to 15 deg if Shift is held
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;

        onUpdateElement(selectedElement.id, { rotation: deg });
      }
    };

    const handlePointerUp = () => {
      setSnapGuideX(null);
      setSnapGuideY(null);
      setSnapDistanceBadge(null);
      if (marquee) {
        const box: Box = {
          x: Math.min(marquee.startX, marquee.x),
          y: Math.min(marquee.startY, marquee.y),
          width: Math.abs(marquee.x - marquee.startX),
          height: Math.abs(marquee.y - marquee.startY),
        };
        if (box.width > 1 || box.height > 1) {
          const ids = expandSelection(slide.elements, elementsInRect(slide.elements, box));
          selectMany(ids, ids[ids.length - 1] ?? null);
          suppressClickRef.current = true;
        }
        setMarquee(null);
      }
      if (isDragging || resizingHandle || isRotating) onInteractionEnd?.();
      setDragOrigins({});
      if (isDrawing && currentInkPoints.length >= 4) {
        // Calculate bounding box
        const xs = currentInkPoints.filter((_, idx) => idx % 2 === 0);
        const ys = currentInkPoints.filter((_, idx) => idx % 2 !== 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const w = Math.max(2, maxX - minX);
        const h = Math.max(2, maxY - minY);

        // Normalize points relative to element width and height
        const normalizedPoints: number[] = [];
        for (let i = 0; i < currentInkPoints.length; i += 2) {
          const relX = ((currentInkPoints[i] - minX) / w) * 100;
          const relY = ((currentInkPoints[i + 1] - minY) / h) * 100;
          normalizedPoints.push(Math.round(relX * 10) / 10, Math.round(relY * 10) / 10);
        }

        onAddInkElement?.({
          type: 'ink',
          x: minX,
          y: minY,
          width: w,
          height: h,
          inkPoints: normalizedPoints,
          inkColor: drawMode === 'highlighter' ? 'rgba(250, 204, 21, 0.45)' : inkColor,
          inkWidth: drawMode === 'highlighter' ? 12 : inkWidth,
        });
      }

      setIsDragging(false);
      setResizingHandle(null);
      setIsRotating(false);
      setDragStart(null);
      setIsDrawing(false);
      setCurrentInkPoints([]);
    };

    if (isDragging || resizingHandle || isRotating || isDrawing || marquee) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  });

  // Keyboard navigation & delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly || editingTextId) return;
      if (e.defaultPrevented || isEditableKeyTarget(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const ids = slide.elements.map((item) => item.id);
        selectMany(ids, ids[ids.length - 1] ?? null);
        return;
      }
      if (selectedIds.length === 0) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (onDeleteElements) onDeleteElements(selectedIds);
        else if (selectedElementId) onDeleteElement?.(selectedElementId);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const origins: Record<string, Box> = {};
        for (const item of slide.elements) {
          if (selectedIds.includes(item.id) && !item.locked) {
            origins[item.id] = { x: item.x, y: item.y, width: item.width, height: item.height };
          }
        }
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        applyPatch(moveBoxes(origins, dx, dy));
      } else if (e.key === 'Escape') {
        onSelectElement(null);
        setEditingTextId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const canvasCursor =
    drawMode === 'pen'
      ? 'crosshair'
      : drawMode === 'highlighter'
      ? 'cell'
      : drawMode === 'eraser'
      ? 'not-allowed'
      : 'default';

  const animBadgeMap: Record<string, { num: number; category: 'entrance' | 'emphasis' | 'exit' | 'motion-path'; animType?: string }> = {};
  collectSlideAnimations(slide.elements).forEach(({ element, anim }, index) => {
    if (animBadgeMap[element.id]) return;
    animBadgeMap[element.id] = { num: index + 1, category: anim.category, animType: anim.type };
  });

  return (
    <div
      ref={containerRef}
      className={`ppt-slide-canvas ${aspectRatio === '4:3' ? 'ratio-4-3' : ''}`}
      style={{ ...backgroundStyle, width: slideBaseWidth(aspectRatio), cursor: canvasCursor }}
      onPointerDown={handleCanvasPointerDown}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (drawMode === 'select') {
          selectMany([], null);
          setEditingTextId(null);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, null);
      }}
    >
      {/* Gridlines Overlay */}
      {showGridlines && <div className="ppt-gridlines-overlay" style={{ backgroundSize: `${gridSize}px ${gridSize}px` }} />}

      {/* Guides Overlay (Center crosshairs) */}
      {showGuides && (
        <div className="ppt-guides-overlay">
          <div className="ppt-guide-line-h" />
          <div className="ppt-guide-line-v" />
        </div>
      )}

      {/* Presentation Watermark */}
      {watermark?.enabled && watermark.text && (
        <div
          className="ppt-canvas-watermark"
          style={{ opacity: watermark.opacity ?? 0.15 }}
        >
          {watermark.text}
        </div>
      )}

      {/* Slide Master Global Header & Footer */}
      {slideMaster?.enabled && (
        <>
          {slideMaster.headerText && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '24px',
                right: '24px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#64748B',
                letterSpacing: '0.8px',
                borderBottom: '1px solid rgba(148,163,184,0.3)',
                paddingBottom: '4px',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              {slideMaster.headerText}
            </div>
          )}
          {slideMaster.footerText && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: slideMaster.dateText ? '35%' : '24px',
                right: slideMaster.dateText ? '35%' : '70px',
                textAlign: slideMaster.dateText ? 'center' : undefined,
                fontSize: '10px',
                color: '#94A3B8',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              {slideMaster.footerText}
            </div>
          )}
          {slideMaster.dateText && (
            <div className="ppt-master-date">{slideMaster.dateText}</div>
          )}
          {slideMaster.showSlideNumber && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '24px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#D83B01',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              Trang {slideIndex + 1}
            </div>
          )}
        </>
      )}

      {/* Smart Magnetic Guides (Cyan Snap Lines) */}
      {snapGuideX !== null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${snapGuideX}%`,
            width: '1.5px',
            background: '#06B6D4',
            zIndex: 900,
            pointerEvents: 'none',
            boxShadow: '0 0 6px #06B6D4',
          }}
        />
      )}
      {snapGuideY !== null && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${snapGuideY}%`,
            height: '1.5px',
            background: '#06B6D4',
            zIndex: 900,
            pointerEvents: 'none',
            boxShadow: '0 0 6px #06B6D4',
          }}
        />
      )}
      {snapDistanceBadge && (
        <div
          style={{
            position: 'absolute',
            left: `${snapDistanceBadge.x}%`,
            top: `${snapDistanceBadge.y}%`,
            transform: 'translate(-50%, -50%)',
            background: '#06B6D4',
            color: '#FFFFFF',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '10px',
            zIndex: 950,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(6,182,212,0.5)',
            letterSpacing: '0.5px',
          }}
        >
          {snapDistanceBadge.text}
        </div>
      )}

      {/* Slide Elements */}
      {slide.elements.filter((el) => !el.hidden).map((el) => {
        const isSelected = !readOnly && selectedIds.includes(el.id);
        const showHandles = isSelected && !isMultiSelection;
        const isHidden = hiddenElementIds.includes(el.id);
        const isEditing = el.id === editingTextId;
        const morph = geometryOverrides?.[el.id];
        const animBadge = animBadgeMap[el.id];

        const elStyle: React.CSSProperties = {
          left: `${morph?.x ?? el.x}%`,
          top: `${morph?.y ?? el.y}%`,
          width: `${morph?.width ?? el.width}%`,
          height: `${morph?.height ?? el.height}%`,
          transform: (morph?.rotation ?? el.rotation) ? `rotate(${morph?.rotation ?? el.rotation}deg)` : undefined,
          opacity: isHidden ? 0 : (morph?.opacity ?? el.opacity ?? 1),
          transition: geometryTransitionSec > 0
            ? ['left', 'top', 'width', 'height', 'transform', 'opacity']
                .map((property) => `${property} ${geometryTransitionSec}s cubic-bezier(0.65, 0, 0.35, 1)`)
                .join(', ')
            : undefined,
          pointerEvents: isHidden ? 'none' : undefined,
          zIndex: el.zIndex ?? (isSelected ? 20 : 10),
          boxShadow: el.shapeShadow
            ? `0 ${el.shadowOffsetY ?? 6}px ${el.shadowBlur ?? 12}px ${el.shadowColor || 'rgba(0,0,0,0.25)'}`
            : undefined,
        };

        return (
          <div
            key={el.id}
            className={`ppt-element ${isSelected ? 'is-selected' : ''} ${isSelected && isMultiSelection ? 'is-multi-selected' : ''}`}
            data-el-id={el.id}
            style={elStyle}
            onPointerDown={(e) => handlePointerDown(e, el)}
            onClick={(e) => {
              if (drawMode === 'select') e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              if (el.type === 'text') setEditingTextId(el.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedIds.includes(el.id)) {
                if (selectedElementId !== el.id) selectMany(selectedIds, el.id);
              } else {
                selectMany(expandSelection(slide.elements, [el.id]), el.id);
              }
              onContextMenu?.(e, el.id);
            }}
          >
            {/* Motion Path Trajectory Indicator (Microsoft PowerPoint authentic vector) */}
            {showAnimBadges && animBadge?.category === 'motion-path' && (
              <div className="ppt-canvas-motion-path-vector" style={{ pointerEvents: 'none' }}>
                <svg
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    overflow: 'visible',
                    pointerEvents: 'none',
                    zIndex: 25,
                  }}
                >
                  <defs>
                    <marker
                      id={`arrowhead-${el.id}`}
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 6 3, 0 6" fill="#DC2626" />
                    </marker>
                  </defs>
                  {/* Origin green dot */}
                  <circle cx="0" cy="0" r="4" fill="#16A34A" stroke="#FFFFFF" strokeWidth="1.5" />
                  {/* Trajectory vector */}
                  {animBadge.animType === 'path-line-up' ? (
                    <line x1="0" y1="0" x2="0" y2="-60" stroke="#7C3AED" strokeWidth="2" strokeDasharray="4 3" markerEnd={`url(#arrowhead-${el.id})`} />
                  ) : animBadge.animType === 'path-line-left' ? (
                    <line x1="0" y1="0" x2="-60" y2="0" stroke="#7C3AED" strokeWidth="2" strokeDasharray="4 3" markerEnd={`url(#arrowhead-${el.id})`} />
                  ) : animBadge.animType === 'path-line-right' ? (
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#7C3AED" strokeWidth="2" strokeDasharray="4 3" markerEnd={`url(#arrowhead-${el.id})`} />
                  ) : animBadge.animType === 'path-arc' ? (
                    <path d="M 0 0 Q 35 -40 70 0" fill="none" stroke="#7C3AED" strokeWidth="2" strokeDasharray="4 3" markerEnd={`url(#arrowhead-${el.id})`} />
                  ) : animBadge.animType === 'path-circle' ? (
                    <circle cx="25" cy="0" r="25" fill="none" stroke="#7C3AED" strokeWidth="2" strokeDasharray="4 3" />
                  ) : (
                    <line x1="0" y1="0" x2="0" y2="60" stroke="#7C3AED" strokeWidth="2" strokeDasharray="4 3" markerEnd={`url(#arrowhead-${el.id})`} />
                  )}
                </svg>
              </div>
            )}

            {/* Numbered Animation Badge */}
            {showAnimBadges && animBadge && (
              <div
                className={`ppt-canvas-anim-badge is-${animBadge.category}`}
                title={`Thứ tự hoạt hình: [${animBadge.num}]`}
              >
                {animBadge.num}
              </div>
            )}

            {/* Lock Badge */}
            {el.locked && (
              <div className="ppt-canvas-lock-badge" title="Đối tượng này đã bị khóa (Lock)">
                <Lock size={12} />
              </div>
            )}

            {/* Live Sheets Linked Badge */}
            {el.sheetLink && (
              <div
                style={{
                  position: 'absolute',
                  top: '-18px',
                  right: '0',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  zIndex: 30,
                  pointerEvents: 'none',
                }}
              >
                <Sheet size={10} /> Minh Sheets: {el.sheetLink.range}
              </div>
            )}
            {!readOnly && <LinkBadge el={el} />}
            {renderElementContent(el, isEditing, (newText) => onUpdateElement(el.id, { text: newText, field: undefined }), (updates) => onUpdateElement(el.id, updates), { slideIndex, presenting, readOnly })}

            {showHandles && drawMode === 'select' && !el.locked && (
              <>
                {/* Rotate Handle */}
                <div className="ppt-rotate-stem" />
                <div
                  className="ppt-rotate-handle"
                  title="Kéo để xoay phần tử (Giữ Shift để xoay 15°)"
                  onPointerDown={handleRotatePointerDown}
                />

                {/* 8 Resize Handles */}
                <div className="ppt-resize-handle ppt-handle-nw" onPointerDown={(e) => handleHandlePointerDown(e, 'nw')} />
                <div className="ppt-resize-handle ppt-handle-n" onPointerDown={(e) => handleHandlePointerDown(e, 'n')} />
                <div className="ppt-resize-handle ppt-handle-ne" onPointerDown={(e) => handleHandlePointerDown(e, 'ne')} />
                <div className="ppt-resize-handle ppt-handle-e" onPointerDown={(e) => handleHandlePointerDown(e, 'e')} />
                <div className="ppt-resize-handle ppt-handle-se" onPointerDown={(e) => handleHandlePointerDown(e, 'se')} />
                <div className="ppt-resize-handle ppt-handle-s" onPointerDown={(e) => handleHandlePointerDown(e, 's')} />
                <div className="ppt-resize-handle ppt-handle-sw" onPointerDown={(e) => handleHandlePointerDown(e, 'sw')} />
                <div className="ppt-resize-handle ppt-handle-w" onPointerDown={(e) => handleHandlePointerDown(e, 'w')} />
              </>
            )}
          </div>
        );
      })}

      {remotePeers.flatMap((peer) => slide.elements.filter((el) => !el.hidden && peer.ids.includes(el.id)).map((el, index) => (
        <div
          key={`${peer.key}:${el.id}`}
          className="ppt-remote-selection"
          style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: `${el.height}%`, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, ['--peer' as string]: peer.color }}
          aria-hidden="true"
        >
          {index === 0 && <span className="ppt-remote-name">{peer.name}</span>}
        </div>
      )))}

      {isMultiSelection && !readOnly && (() => {
        const frame = boundsOf(slide.elements.filter((item) => selectedIds.includes(item.id)));
        return (
          <div
            className="ppt-selection-frame"
            style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%` }}
          />
        );
      })()}

      {marquee && (
        <div
          className="ppt-marquee"
          style={{
            left: `${Math.min(marquee.startX, marquee.x)}%`,
            top: `${Math.min(marquee.startY, marquee.y)}%`,
            width: `${Math.abs(marquee.x - marquee.startX)}%`,
            height: `${Math.abs(marquee.y - marquee.startY)}%`,
          }}
        />
      )}

      {/* Live Freehand Ink drawing preview */}
      {isDrawing && currentInkPoints.length >= 4 && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 999,
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={currentInkPoints.join(' ')}
            fill="none"
            stroke={drawMode === 'highlighter' ? 'rgba(250, 204, 21, 0.45)' : inkColor}
            strokeWidth={drawMode === 'highlighter' ? 12 : inkWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}

function renderElementContent(
  el: SlideElement,
  isEditing: boolean,
  onTextChange: (val: string) => void,
  onUpdateElementProps?: (updates: Partial<SlideElement>) => void,
  ctx: { slideIndex: number; presenting: boolean; readOnly: boolean } = { slideIndex: 0, presenting: false, readOnly: false }
): ReactNode {
  if (el.type === 'icon') return <IconElementView el={el} />;
  if (el.type === 'audio') return <AudioElementView el={el} presenting={ctx.presenting} />;
  if (el.type === 'cameo') return <CameoElementView el={el} live={ctx.presenting || !ctx.readOnly} />;
  if (el.type === 'object') return <ObjectElementView el={el} />;
  if (el.type === 'text') {
    const textStyle: React.CSSProperties = {
      fontFamily: el.fontFamily || 'Segoe UI, sans-serif',
      fontSize: `${el.fontSize || 18}px`,
      fontWeight: el.fontWeight || 'normal',
      fontStyle: el.fontStyle || 'normal',
      textDecoration: textDecorationOf(el),
      color: el.color || '#1E293B',
      textAlign: el.textAlign || 'left',
      justifyContent:
        el.verticalAlign === 'bottom'
          ? 'flex-end'
          : el.verticalAlign === 'middle'
          ? 'center'
          : 'flex-start',
      lineHeight: el.lineHeight || 1.4,
      padding: `${el.padding ?? 8}px`,
      textShadow: el.textShadow ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
      ...textEffectStyle(el),
    };

    if (isEditing) {
      return (
        <div
          contentEditable
          suppressContentEditableWarning
          spellCheck={getSettings().slideSpellcheck}
          className="ppt-text-box is-editing"
          style={textStyle}
          autoFocus
          onBlur={(e) => onTextChange(e.currentTarget.innerText)}
        >
          {el.text}
        </div>
      );
    }

    return (
      <div className="ppt-text-box" style={textStyle}>
        {el.text || el.field ? (
          <RichTextLines el={el} slideIndex={ctx.slideIndex} />
        ) : (
          <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>
            {el.placeholder || 'Bấm đúp để nhập văn bản'}
          </span>
        )}
      </div>
    );
  }

  if (el.type === 'shape') {
    const lineShape = el.shapeType !== 'custom' && isLineShape(el.shapeType);
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <ShapeSvg el={el} />
        {el.text && !lineShape && (
          <div
            className="ppt-shape-text-overlay"
            style={{
              color: el.color || '#FFFFFF',
              fontSize: `${el.fontSize || 16}px`,
              fontFamily: el.fontFamily || 'Segoe UI, sans-serif',
              fontWeight: el.fontWeight,
              fontStyle: el.fontStyle,
              textDecoration: textDecorationOf(el),
              lineHeight: el.lineHeight,
              whiteSpace: 'pre-wrap',
              ...textEffectStyle(el),
              textAlign: el.textAlign,
              justifyContent:
                el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : undefined,
              alignItems:
                el.verticalAlign === 'top' ? 'flex-start' : el.verticalAlign === 'bottom' ? 'flex-end' : undefined,
            }}
          >
            {el.highlight || el.textGradient || el.isBullet ? <RichTextLines el={el} slideIndex={ctx.slideIndex} /> : el.text}
          </div>
        )}
      </div>
    );
  }

  if (el.type === 'image' && el.src) {
    const effect = imageEffectStyle(el);
    let clipPath: string | undefined = undefined;
    if (el.imageMask === 'circle') clipPath = 'circle(50% at 50% 50%)';
    else if (el.imageMask === 'hexagon') clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
    else if (el.imageMask === 'star') clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    else if (el.imageMask === 'diamond') clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    else if (el.imageMask === 'rounded') clipPath = 'inset(0 round 16px)';

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          WebkitBoxReflect: el.reflection ? 'below 2px linear-gradient(transparent, transparent 65%, rgba(255,255,255,0.4))' : undefined,
          clipPath: effect.crop,
        }}
      >
        <img
          src={el.src}
          alt={el.alt || 'Hình ảnh slide'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: el.objectFit || 'cover',
            borderRadius: `${el.borderRadius ?? 6}px`,
            clipPath,
            pointerEvents: 'none',
            transform: el.flipH || el.flipV ? `scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})` : undefined,
            filter: effect.filter,
            boxShadow: el.reflection || el.shapeShadow === false ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
      </div>
    );
  }

  if (el.type === 'table' && el.tableData) {
    return (
      <table className="ppt-table">
        <tbody>
          {el.tableData.map((row, rIdx) => {
            const isHeader = rIdx === 0 && el.tableHeaderRow;
            return (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      background: isHeader
                        ? (el.tableHeaderColor || '#D83B01')
                        : (rIdx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'),
                      color: isHeader ? (el.tableHeaderTextColor || '#FFFFFF') : '#1E293B',
                      fontWeight: isHeader ? 'bold' : 'normal',
                      textAlign: 'center',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (el.type === 'chart' && el.chartSeries && el.chartCategories) {
    return (
      <div className="ppt-chart-box">
        {el.chartTitle && (
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1E293B', marginBottom: '8px', textAlign: 'center' }}>
            {el.chartTitle}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '10px 16px' }}>
          {el.chartCategories.map((cat, cIdx) => (
            <div key={cIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px', width: '100%', justifyContent: 'center' }}>
                {el.chartSeries!.map((series, sIdx) => {
                  const val = series.values[cIdx] || 0;
                  const maxVal = Math.max(...el.chartSeries!.flatMap((s) => s.values)) || 100;
                  const heightPct = Math.round((val / maxVal) * 100);
                  return (
                    <div
                      key={sIdx}
                      style={{
                        width: '20px',
                        height: `${Math.max(8, heightPct)}%`,
                        background: series.color || '#0284C7',
                        borderRadius: '4px 4px 0 0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}
                      title={`${series.name}: ${val}`}
                    />
                  );
                })}
              </div>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>{cat}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (el.type === 'smartart' && el.smartArtItems) {
    return (
      <div className="ppt-smartart-container">
        {el.smartArtItems.map((item, idx) => (
          <div key={idx} className="ppt-smartart-card" style={{ background: item.color || '#0284C7' }}>
            <h4>{item.title}</h4>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    );
  }

  if (el.type === 'ink' && el.inkPoints) {
    return (
      <svg
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline
          points={el.inkPoints.join(' ')}
          fill="none"
          stroke={el.inkColor || '#000000'}
          strokeWidth={el.inkWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  if (el.type === 'code') {
    const code = el.codeContent || el.text || '// Minh Spark Code Snippet\nfunction presentationSuperpower() {\n  console.log("Ready to present!");\n}';
    const lang = el.codeLang || 'typescript';
    return (
      <div className="ppt-code-container">
        <div className="ppt-code-header">
          <span className="ppt-code-lang-tag">{lang.toUpperCase()}</span>
          <span className="ppt-code-title">{el.placeholder || 'Khối Mã Nguồn'}</span>
          <button
            type="button"
            className="ppt-code-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard?.writeText(code);
            }}
            title="Sao chép mã nguồn"
          >
            <Copy size={12} /> Copy
          </button>
        </div>
        <pre className="ppt-code-pre">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  if (el.type === 'math') {
    const formula = el.mathFormula || el.text || 'f(x) = \\int_{-\\infty}^\\infty \\hat{f}(\\xi) e^{2\\pi i \\xi x} d\\xi';
    return (
      <div className="ppt-math-container">
        <div className="ppt-math-formula">{formula}</div>
        <div className="ppt-math-sub">Công thức Toán (LaTeX)</div>
      </div>
    );
  }

  if (el.type === 'zoom') {
    return (
      <div className="ppt-zoom-container">
        <div className="ppt-zoom-thumb">
          <div className="ppt-zoom-inner">
            <ZoomIn size={24} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>
              {el.zoomSlideTitle || 'Trang chiếu phóng to (Slide Zoom)'}
            </span>
          </div>
        </div>
        <div className="ppt-zoom-badge">Slide Zoom</div>
      </div>
    );
  }

  if (el.type === '3d') {
    const rotX = el.model3d?.rotX ?? 25;
    const rotY = el.model3d?.rotY ?? -35;
    const color = el.model3d?.color || '#0284C7';
    const modelType = el.model3d?.type || 'cube';

    return (
      <div
        className="ppt-3d-container"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '800px',
          background: 'radial-gradient(circle at center, rgba(30,41,59,0.1) 0%, transparent 70%)',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const origRotX = rotX;
          const origRotY = rotY;
          const moveHandler = (me: PointerEvent) => {
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;
            onUpdateElementProps?.({
              model3d: {
                ...(el.model3d || { type: 'cube', rotX: 25, rotY: -35, rotZ: 0, zoom: 1 }),
                rotX: origRotX - dy * 0.5,
                rotY: origRotY + dx * 0.5,
              },
            });
          };
          const upHandler = () => {
            window.removeEventListener('pointermove', moveHandler);
            window.removeEventListener('pointerup', upHandler);
          };
          window.addEventListener('pointermove', moveHandler);
          window.addEventListener('pointerup', upHandler);
        }}
      >
        <div
          style={{
            width: '100px',
            height: '100px',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            transition: 'transform 0.05s ease-out',
            cursor: 'grab',
          }}
        >
          <div style={{ position: 'absolute', width: '100px', height: '100px', background: color, opacity: 0.85, transform: 'translateZ(50px)', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 700, fontSize: '12px' }}>TRƯỚC</div>
          <div style={{ position: 'absolute', width: '100px', height: '100px', background: color, filter: 'brightness(0.7)', transform: 'rotateY(180deg) translateZ(50px)', border: '1px solid rgba(255,255,255,0.3)' }} />
          <div style={{ position: 'absolute', width: '100px', height: '100px', background: color, filter: 'brightness(0.85)', transform: 'rotateY(-90deg) translateZ(50px)', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 700, fontSize: '11px' }}>TRÁI</div>
          <div style={{ position: 'absolute', width: '100px', height: '100px', background: color, filter: 'brightness(0.75)', transform: 'rotateY(90deg) translateZ(50px)', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 700, fontSize: '11px' }}>PHẢI</div>
          <div style={{ position: 'absolute', width: '100px', height: '100px', background: color, filter: 'brightness(1.15)', transform: 'rotateX(90deg) translateZ(50px)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 700, fontSize: '11px' }}>ĐỈNH</div>
          <div style={{ position: 'absolute', width: '100px', height: '100px', background: color, filter: 'brightness(0.5)', transform: 'rotateX(-90deg) translateZ(50px)' }} />
        </div>
        <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.85)', color: '#FFF', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <Cuboid size={12} /> Mô hình 3D ({modelType.toUpperCase()}) • Kéo chuột xoay 360°
        </div>
      </div>
    );
  }

  if (el.type === 'video') {
    const videoData = el.videoData || {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      autoplay: true,
      loop: true,
      shape: 'rounded' as const,
    };
    const borderRadius = videoData.shape === 'oval' ? '999px' : videoData.shape === 'rounded' ? '14px' : '4px';

    return (
      <div
        className="ppt-video-container"
        style={{
          width: '100%',
          height: '100%',
          borderRadius,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          background: '#000000',
          position: 'relative',
        }}
      >
        <video
          src={videoData.url}
          poster={videoData.poster}
          controls
          autoPlay={videoData.autoplay}
          loop={videoData.loop}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'rgba(15,23,42,0.8)',
            color: '#38BDF8',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            pointerEvents: 'none',
          }}
        >
          <Clapperboard size={12} /> Video Studio • {videoData.trimStart ?? 0}s - {videoData.trimEnd ?? 60}s
        </div>
      </div>
    );
  }

  if (el.type === 'countdown') {
    const cData = el.countdownData || { duration: 300, remaining: 300, running: false, title: 'Thảo luận nhóm: 05:00' };
    const mins = Math.floor(cData.remaining / 60);
    const secs = cData.remaining % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return (
      <div
        className="ppt-countdown-widget"
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          border: '2px solid #38BDF8',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          padding: '12px',
          boxShadow: '0 8px 30px rgba(56, 189, 248, 0.25)',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '4px' }}>
          ⏱ ${cData.title || 'Đồng hồ đếm ngược'}
        </span>
        <div style={{ fontSize: '38px', fontWeight: 800, fontFamily: 'Consolas, monospace', color: cData.remaining <= 30 ? '#EF4444' : '#38BDF8', letterSpacing: '2px' }}>
          {timeFormatted}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button
            type="button"
            className="ppt-secondary-action-btn"
            style={{ padding: '2px 10px', fontSize: '11px', background: cData.running ? '#EF4444' : '#059669', color: '#FFF', border: 'none' }}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateElementProps?.({
                countdownData: {
                  ...cData,
                  running: !cData.running,
                  remaining: cData.remaining > 0 ? cData.remaining : cData.duration,
                },
              });
            }}
          >
            {cData.running ? <><Pause size={12} /> Tạm dừng</> : <><Play size={12} /> Bắt đầu</>}
          </button>
          <button
            type="button"
            className="ppt-secondary-action-btn"
            style={{ padding: '2px 8px', fontSize: '11px', color: '#94A3B8', background: 'rgba(255,255,255,0.1)', border: 'none' }}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateElementProps?.({
                countdownData: { ...cData, remaining: cData.duration, running: false },
              });
            }}
          >
            <RotateCcw size={12} /> Đặt lại
          </button>
        </div>
      </div>
    );
  }

  if (el.type === 'poll') {
    const pData = el.pollData || {
      question: 'Bình chọn trực tiếp: Định hướng phát triển?',
      options: [
        { id: '1', text: 'Tối ưu hiệu năng offline', votes: 45 },
        { id: '2', text: 'Mở rộng tính năng thuyết trình', votes: 72 },
        { id: '3', text: 'Bảo mật dữ liệu tối đa', votes: 31 },
      ],
      type: 'multiple' as const,
      active: true,
      qrCode: true,
    };
    const totalVotes = pData.options.reduce((sum, opt) => sum + opt.votes, 0) || 1;

    return (
      <div
        className="ppt-poll-container"
        style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#D83B01', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <ChartNoAxesColumn size={12} /> LIVE AUDIENCE POLL
            </span>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: '4px 0 0 0' }}>
              {pData.question}
            </h4>
          </div>
          {pData.qrCode && (
            <div style={{ textAlign: 'center', background: '#F8FAFC', padding: '4px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <div style={{ width: '40px', height: '40px', background: '#0F172A', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800 }}>
                QR VOTE
              </div>
              <span style={{ fontSize: '9px', color: '#64748B' }}>Quét mã</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
          {pData.options.map((opt) => {
            const pct = Math.round((opt.votes / totalVotes) * 100);
            return (
              <div
                key={opt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  const updatedOpts = pData.options.map((o) => (o.id === opt.id ? { ...o, votes: o.votes + 1 } : o));
                  onUpdateElementProps?.({ pollData: { ...pData, options: updatedOpts } });
                }}
                style={{
                  position: 'relative',
                  background: '#F1F5F9',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #BAE6FD 0%, #38BDF8 100%)',
                    opacity: 0.6,
                    transition: 'width 0.4s ease',
                  }}
                />
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                  <span>{opt.text}</span>
                  <span style={{ color: '#0284C7' }}>{pct}% ({opt.votes})</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
          <span>Tổng số phiếu: <strong>{totalVotes}</strong></span>
          <span style={{ color: '#16A34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ToneDot tone="entrance" /> Đang mở nhận bình chọn</span>
        </div>
      </div>
    );
  }

  return <div style={{ width: '100%', height: '100%' }} />;
}
