import type { CSSProperties } from 'react';
import type { SlideElement } from '../../lib/slideTypes';
import { getShapeDef, type ShapeDef } from '../../lib/slideShapes';

const DEFAULT_FILL = '#0284C7';
const DETAIL_SHADE = 'rgba(15, 23, 42, 0.35)';

function isVisibleColor(color: string | undefined): color is string {
  return Boolean(color) && color !== 'transparent' && color !== 'none';
}

function dashArray(borderStyle: SlideElement['borderStyle'], width: number): string | undefined {
  if (borderStyle === 'dashed') return `${width * 4},${width * 2.5}`;
  if (borderStyle === 'dotted') return `${width},${width * 1.6}`;
  return undefined;
}

function maskUrl(d: string, evenOdd: boolean): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${d}" fill-rule="${evenOdd ? 'evenodd' : 'nonzero'}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function LineShape({ el, def }: { el: SlideElement; def: ShapeDef }) {
  const color = isVisibleColor(el.stroke) ? el.stroke : el.fill || DEFAULT_FILL;
  const width = Math.max(1, el.strokeWidth || 2);
  const head = Math.max(8, width * 3.2);
  const headStyle = (side: 'left' | 'right'): CSSProperties => ({
    width: 0,
    height: 0,
    flex: 'none',
    borderTop: `${head / 2}px solid transparent`,
    borderBottom: `${head / 2}px solid transparent`,
    ...(side === 'left' ? { borderRight: `${head}px solid ${color}` } : { borderLeft: `${head}px solid ${color}` }),
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
      {def.line === 'both' && <span style={headStyle('left')} />}
      <span
        style={{
          flex: 1,
          borderTop: `${width}px ${el.borderStyle || 'solid'} ${color}`,
        }}
      />
      {def.line !== 'none' && <span style={headStyle('right')} />}
    </div>
  );
}

export function ShapeSvg({ el }: { el: SlideElement }) {
  const def = getShapeDef(el.shapeType);
  if (el.shapeType !== 'custom' && def.line) return <LineShape el={el} def={def} />;

  const d = el.shapeType === 'custom' && el.customPath ? el.customPath : def.d;
  const evenOdd = el.shapeType === 'custom' ? true : Boolean(def.evenOdd);
  const detail = el.shapeType === 'custom' ? undefined : def.detail;
  const hasGradient = el.fillType === 'gradient' && Boolean(el.gradient);
  const noFill = el.fillType === 'none';
  const hasStroke = isVisibleColor(el.stroke) && el.strokeWidth !== 0;
  const strokeWidth = el.strokeWidth || 1;
  const flip = el.flipH || el.flipV ? `scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})` : undefined;
  const mask = hasGradient ? maskUrl(d, evenOdd) : undefined;

  return (
    <div style={{ position: 'absolute', inset: 0, transform: flip }}>
      {hasGradient && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: el.gradient,
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        />
      )}
      <svg
        className="ppt-shape-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <path
          d={d}
          fill={hasGradient || noFill ? 'none' : el.fill || DEFAULT_FILL}
          fillRule={evenOdd ? 'evenodd' : 'nonzero'}
          stroke={hasStroke ? el.stroke : 'none'}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray(el.borderStyle, strokeWidth)}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {detail && (
          <path
            d={detail}
            fill="none"
            stroke={hasStroke ? el.stroke : DETAIL_SHADE}
            strokeWidth={hasStroke ? strokeWidth : 1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

export function ShapeGlyph({ def, size = 20 }: { def: ShapeDef; size?: number }) {
  if (def.line) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20L20 4" />
        {def.line !== 'none' && <path d="M12 4H20V12" />}
        {def.line === 'both' && <path d="M4 12V20H12" />}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="-8 -8 116 116" aria-hidden="true">
      <path d={def.d} fill="none" fillRule={def.evenOdd ? 'evenodd' : 'nonzero'} stroke="currentColor" strokeWidth={7} strokeLinejoin="round" />
      {def.detail && <path d={def.detail} fill="none" stroke="currentColor" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  );
}
