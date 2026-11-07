import { useRef, useState, useEffect, type ReactNode } from 'react';
import type { SlideData, SlideElement, ShapeType } from '../../lib/slideTypes';

interface SlideCanvasProps {
  slide: SlideData;
  aspectRatio: '16:9' | '4:3';
  zoom: number; // percentage, e.g. 100
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onDeleteElement?: (id: string) => void;
  readOnly?: boolean;
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
}: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resizingHandle, setResizingHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; elX: number; elY: number; elW: number; elH: number } | null>(null);

  const selectedElement = slide.elements.find((el) => el.id === selectedElementId);

  // Background style computation
  const backgroundStyle: React.CSSProperties = {
    background: slide.background.value || '#FFFFFF',
    transform: `scale(${zoom / 100})`,
    transformOrigin: 'center center',
  };

  const handlePointerDown = (e: React.PointerEvent, el: SlideElement) => {
    if (readOnly) return;
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

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStart || !selectedElement || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const deltaXPct = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragStart.y) / rect.height) * 100;

      if (isDragging) {
        const newX = Math.max(0, Math.min(100 - selectedElement.width, dragStart.elX + deltaXPct));
        const newY = Math.max(0, Math.min(100 - selectedElement.height, dragStart.elY + deltaYPct));
        onUpdateElement(selectedElement.id, { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
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
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setResizingHandle(null);
      setDragStart(null);
    };

    if (isDragging || resizingHandle) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, resizingHandle, dragStart, selectedElement, onUpdateElement]);

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

  return (
    <div
      ref={containerRef}
      className={`ppt-slide-canvas ${aspectRatio === '4:3' ? 'ratio-4-3' : ''}`}
      style={backgroundStyle}
      onClick={() => {
        onSelectElement(null);
        setEditingTextId(null);
      }}
    >
      {slide.elements.map((el) => {
        const isSelected = !readOnly && el.id === selectedElementId;
        const isEditing = el.id === editingTextId;

        const elStyle: React.CSSProperties = {
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.width}%`,
          height: `${el.height}%`,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          opacity: el.opacity ?? 1,
          zIndex: el.zIndex ?? (isSelected ? 20 : 10),
        };

        return (
          <div
            key={el.id}
            className={`ppt-element ${isSelected ? 'is-selected' : ''}`}
            style={elStyle}
            onPointerDown={(e) => handlePointerDown(e, el)}
            onDoubleClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              if (el.type === 'text') setEditingTextId(el.id);
            }}
          >
            {renderElementContent(el, isEditing, (newText) => onUpdateElement(el.id, { text: newText }))}

            {isSelected && (
              <>
                <div className="ppt-rotate-stem" />
                <div className="ppt-rotate-handle" title="Xoay phần tử" />

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
      justifyContent: el.verticalAlign === 'bottom' ? 'flex-end' : el.verticalAlign === 'middle' ? 'center' : 'flex-start',
      lineHeight: el.lineHeight || 1.4,
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
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <svg className="ppt-shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {renderSvgShape(el.shapeType || 'rectangle', el.fill || '#0284C7', el.stroke || 'transparent', el.strokeWidth || 1)}
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
                      background: isHeader ? (el.tableHeaderColor || '#D83B01') : (rIdx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'),
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

  return <div style={{ width: '100%', height: '100%' }} />;
}

function renderSvgShape(shapeType: ShapeType, fill: string, stroke: string, strokeWidth: number) {
  switch (shapeType) {
    case 'circle':
      return <circle cx="50" cy="50" r="48" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'triangle':
      return <polygon points="50,4 96,96 4,96" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'diamond':
      return <polygon points="50,4 96,50 50,96 4,50" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'hexagon':
      return <polygon points="25,4 75,4 96,50 75,96 25,96 4,50" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'star':
      return (
        <polygon
          points="50,4 62,35 96,35 68,57 79,90 50,70 21,90 32,57 4,35 38,35"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'right-arrow':
      return (
        <polygon
          points="4,30 60,30 60,10 96,50 60,90 60,70 4,70"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'left-arrow':
      return (
        <polygon
          points="96,30 40,30 40,10 4,50 40,90 40,70 96,70"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'rounded-rectangle':
      return <rect x="2" y="2" width="96" height="96" rx="14" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'callout':
      return (
        <polygon
          points="4,4 96,4 96,70 40,70 20,96 25,70 4,70"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'heart':
      return (
        <path
          d="M 50,88 C 10,60 0,35 0,20 C 0,8 10,0 25,0 C 37,0 46,10 50,18 C 54,10 63,0 75,0 C 90,0 100,8 100,20 C 100,35 90,60 50,88 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    default:
      return <rect x="2" y="2" width="96" height="96" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
}
