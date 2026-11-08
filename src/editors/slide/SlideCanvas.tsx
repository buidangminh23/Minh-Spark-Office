import { useRef, useState, useEffect, type ReactNode } from 'react';
import type { SlideData, SlideElement, ShapeType } from '../../lib/slideTypes';

interface SlideCanvasProps {
  slide: SlideData;
  aspectRatio: '16:9' | '4:3';
  zoom: number;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onDeleteElement?: (id: string) => void;
  readOnly?: boolean;
  showGridlines?: boolean;
  showGuides?: boolean;
  drawMode?: 'select' | 'pen' | 'highlighter' | 'eraser';
  inkColor?: string;
  inkWidth?: number;
  onAddInkElement?: (el: Partial<SlideElement>) => void;
  onContextMenu?: (e: React.MouseEvent, elementId: string | null) => void;
  isPreviewingTransition?: boolean;
  previewingAnimElementId?: string | null;
  showAnimBadges?: boolean;
  hiddenElementIds?: string[];
}

export function SlideCanvas({
  slide,
  aspectRatio,
  zoom,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  readOnly = false,
  showGridlines = false,
  showGuides = false,
  drawMode = 'select',
  inkColor = '#000000',
  inkWidth = 3,
  onAddInkElement,
  onContextMenu,
  isPreviewingTransition = false,
  previewingAnimElementId = null,
  showAnimBadges = true,
  hiddenElementIds = [],
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

  const selectedElement = slide.elements.find((el) => el.id === selectedElementId);

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
    onSelectElement(el.id);

    if (editingTextId === el.id) return;

    const container = containerRef.current;
    if (!container) return;

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

      if (!dragStart || !selectedElement) return;

      const deltaXPct = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragStart.y) / rect.height) * 100;

      if (isDragging) {
        const newX = Math.max(0, Math.min(100 - selectedElement.width, dragStart.elX + deltaXPct));
        const newY = Math.max(0, Math.min(100 - selectedElement.height, dragStart.elY + deltaYPct));
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

    if (isDragging || resizingHandle || isRotating || isDrawing) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [
    isDragging,
    resizingHandle,
    isRotating,
    isDrawing,
    dragStart,
    selectedElement,
    currentInkPoints,
    drawMode,
    inkColor,
    inkWidth,
    onAddInkElement,
    onUpdateElement,
  ]);

  // Keyboard navigation & delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly || !selectedElementId || editingTextId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        onDeleteElement?.(selectedElementId);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const el = slide.elements.find((item) => item.id === selectedElementId);
        if (!el) return;

        let { x, y } = el;
        if (e.key === 'ArrowUp') y = Math.max(0, y - step);
        if (e.key === 'ArrowDown') y = Math.min(100 - el.height, y + step);
        if (e.key === 'ArrowLeft') x = Math.max(0, x - step);
        if (e.key === 'ArrowRight') x = Math.min(100 - el.width, x + step);

        onUpdateElement(el.id, { x, y });
      } else if (e.key === 'Escape') {
        onSelectElement(null);
        setEditingTextId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, selectedElementId, editingTextId, slide.elements, onDeleteElement, onSelectElement, onUpdateElement]);

  const canvasCursor =
    drawMode === 'pen'
      ? 'crosshair'
      : drawMode === 'highlighter'
      ? 'cell'
      : drawMode === 'eraser'
      ? 'not-allowed'
      : 'default';

  // Map all animated elements to sequential 1-based order
  const animBadgeMap: Record<string, { num: number; category: 'entrance' | 'emphasis' | 'exit' | 'motion-path'; animType?: string }> = {};
  let animCount = 1;
  slide.elements.forEach((el) => {
    if ((el.animations && el.animations.length > 0) || (el.animation && el.animation.type !== 'none')) {
      const firstAnim = el.animations?.[0];
      let cat: 'entrance' | 'emphasis' | 'exit' | 'motion-path' = 'entrance';
      if (firstAnim?.category) {
        cat = firstAnim.category;
        cat = firstAnim.category;
      } else if (el.animation?.type) {
        const t = el.animation.type;
        if (t.includes('path-')) cat = 'motion-path';
        else if (t.includes('out') || t.includes('disappear')) cat = 'exit';
        else if (t.includes('pulse') || t.includes('spin') || t.includes('teeter') || t.includes('grow-shrink') || t.includes('wave') || t.includes('darken') || t.includes('lighten')) cat = 'emphasis';
        else cat = 'entrance';
      }
      animBadgeMap[el.id] = { num: animCount++, category: cat, animType: firstAnim?.type || el.animation?.type };
    }
  });

  return (
    <div
      ref={containerRef}
      className={`ppt-slide-canvas ${aspectRatio === '4:3' ? 'ratio-4-3' : ''} ${
        isPreviewingTransition ? `is-previewing-transition trans-${slide.transition?.type || 'fade'}` : ''
      }`}
      style={{ ...backgroundStyle, cursor: canvasCursor }}
      onPointerDown={handleCanvasPointerDown}
      onClick={() => {
        if (drawMode === 'select') {
          onSelectElement(null);
          setEditingTextId(null);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, null);
      }}
    >
      {/* Gridlines Overlay */}
      {showGridlines && <div className="ppt-gridlines-overlay" />}

      {/* Guides Overlay (Center crosshairs) */}
      {showGuides && (
        <div className="ppt-guides-overlay">
          <div className="ppt-guide-line-h" />
          <div className="ppt-guide-line-v" />
        </div>
      )}

      {/* Slide Elements */}
      {slide.elements.map((el) => {
        const isSelected = !readOnly && el.id === selectedElementId;
        const isHidden = hiddenElementIds.includes(el.id);
        const isEditing = el.id === editingTextId;
        const isAnimPreview = previewingAnimElementId === 'ALL' || previewingAnimElementId === el.id;
        const animType = el.animations?.[0]?.type || el.animation?.type || 'fade-in';
        const animBadge = animBadgeMap[el.id];

        const elStyle: React.CSSProperties = {
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.width}%`,
          height: `${el.height}%`,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          opacity: isHidden ? 0 : (el.opacity ?? 1),
          pointerEvents: isHidden ? 'none' : undefined,
          zIndex: el.zIndex ?? (isSelected ? 20 : 10),
          boxShadow: el.shapeShadow
            ? `0 ${el.shadowOffsetY ?? 6}px ${el.shadowBlur ?? 12}px ${el.shadowColor || 'rgba(0,0,0,0.25)'}`
            : undefined,
        };

        return (
          <div
            key={el.id}
            className={`ppt-element ${isSelected ? 'is-selected' : ''} ${
              isAnimPreview ? `is-previewing-anim anim-${animType}` : ''
            }`}
            style={elStyle}
            onPointerDown={(e) => handlePointerDown(e, el)}
            onClick={(e) => {
              if (drawMode === 'select') {
                e.stopPropagation();
                onSelectElement(el.id);
              }
            }}
            onDoubleClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              if (el.type === 'text') setEditingTextId(el.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectElement(el.id);
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

            {renderElementContent(el, isEditing, (newText) => onUpdateElement(el.id, { text: newText }))}

            {isSelected && drawMode === 'select' && (
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
            strokeWidth={drawMode === 'highlighter' ? 3.5 : (inkWidth / 10)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

function renderElementContent(
  el: SlideElement,
  isEditing: boolean,
  onTextChange: (val: string) => void
): ReactNode {
  if (el.type === 'text') {
    const textStyle: React.CSSProperties = {
      fontFamily: el.fontFamily || 'Segoe UI, sans-serif',
      fontSize: `${el.fontSize || 18}px`,
      fontWeight: el.fontWeight || 'normal',
      fontStyle: el.fontStyle || 'normal',
      textDecoration: el.textDecoration || 'none',
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
    };

    if (isEditing) {
      return (
        <div
          contentEditable
          suppressContentEditableWarning
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
        {el.text ? (
          el.text.split('\n').map((line, idx) => (
            <div key={idx}>{line || '\u00A0'}</div>
          ))
        ) : (
          <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>
            {el.placeholder || 'Bấm đúp để nhập văn bản'}
          </span>
        )}
      </div>
    );
  }

  if (el.type === 'shape') {
    const isGradient = el.fillType === 'gradient' && el.gradient;

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          borderRadius: `${el.borderRadius || 0}px`,
          background: isGradient ? el.gradient : undefined,
          overflow: 'hidden',
        }}
      >
        <svg className="ppt-shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {renderSvgShape(
            el.shapeType || 'rectangle',
            isGradient ? 'transparent' : (el.fill || '#0284C7'),
            el.stroke || 'transparent',
            el.strokeWidth || 1,
            el.borderStyle || 'solid'
          )}
        </svg>
        {el.text && (
          <div
            className="ppt-shape-text-overlay"
            style={{
              color: el.color || '#FFFFFF',
              fontSize: `${el.fontSize || 16}px`,
              fontFamily: el.fontFamily || 'Segoe UI, sans-serif',
            }}
          >
            {el.text}
          </div>
        )}
      </div>
    );
  }

  if (el.type === 'image' && el.src) {
    return (
      <img
        src={el.src}
        alt={el.alt || 'Hình ảnh slide'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: el.objectFit || 'cover',
          borderRadius: `${el.borderRadius || 6}px`,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      />
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
        />
      </svg>
    );
  }

  return <div style={{ width: '100%', height: '100%' }} />;
}

function renderSvgShape(
  shapeType: ShapeType,
  fill: string,
  stroke: string,
  strokeWidth: number,
  borderStyle: 'solid' | 'dashed' | 'dotted' = 'solid'
) {
  const dashArray = borderStyle === 'dashed' ? '6,3' : borderStyle === 'dotted' ? '2,2' : undefined;

  switch (shapeType) {
    case 'circle':
      return <circle cx="50" cy="50" r="48" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
    case 'triangle':
      return <polygon points="50,4 96,96 4,96" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
    case 'diamond':
      return <polygon points="50,4 96,50 50,96 4,50" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
    case 'hexagon':
      return <polygon points="25,4 75,4 96,50 75,96 25,96 4,50" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
    case 'star':
      return (
        <polygon
          points="50,4 62,35 96,35 68,57 79,90 50,70 21,90 32,57 4,35 38,35"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
        />
      );
    case 'right-arrow':
      return (
        <polygon
          points="4,30 60,30 60,10 96,50 60,90 60,70 4,70"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
        />
      );
    case 'left-arrow':
      return (
        <polygon
          points="96,30 40,30 40,10 4,50 40,90 40,70 96,70"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
        />
      );
    case 'rounded-rectangle':
      return <rect x="2" y="2" width="96" height="96" rx="14" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
    case 'callout':
      return (
        <polygon
          points="4,4 96,4 96,70 40,70 20,96 25,70 4,70"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
        />
      );
    case 'heart':
      return (
        <path
          d="M 50,88 C 10,60 0,35 0,20 C 0,8 10,0 25,0 C 37,0 46,10 50,18 C 54,10 63,0 75,0 C 90,0 100,8 100,20 C 100,35 90,60 50,88 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
        />
      );
    default:
      return <rect x="2" y="2" width="96" height="96" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />;
  }
}
