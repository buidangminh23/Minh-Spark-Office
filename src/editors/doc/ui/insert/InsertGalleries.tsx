import { useMemo, useState } from 'react';
import katex from 'katex';
import { SHAPES, SHAPE_GROUPS, shapeDataUrl } from '../../insertShapes';
import { BUILTIN_EQUATIONS, COVER_STYLES } from '../../insertGalleries';
import { loadRecentSymbols, pushRecentSymbol } from '../../insertActions';

export function TableGrid({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  return (
    <div className="table-grid-picker">
      <div className="table-grid-label">{hover.rows ? `Bảng ${hover.cols} × ${hover.rows}` : 'Chèn bảng'}</div>
      <div className="table-grid" onMouseLeave={() => setHover({ rows: 0, cols: 0 })}>
        {Array.from({ length: 8 }, (_, r) => Array.from({ length: 10 }, (_, c) => (
          <button key={`${r}-${c}`} type="button" aria-label={`${c + 1} × ${r + 1}`} className={`table-grid-cell ${r < hover.rows && c < hover.cols ? 'on' : ''}`} onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })} onClick={() => onPick(r + 1, c + 1)} />
        )))}
      </div>
    </div>
  );
}

export type ShapePick = { id: string; label: string; fill: string; stroke: string; text: string };

export function ShapeGallery({ onPick }: { onPick: (shape: ShapePick) => void }) {
  const [fill, setFill] = useState('#dbe6fb');
  const [stroke, setStroke] = useState('#2b579a');
  const [text, setText] = useState('');
  return (
    <div className="shape-gallery insert-shape-gallery">
      <div className="shape-colors">
        <label>Tô <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} /></label>
        <label>Viền <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} /></label>
        <input className="text-field insert-shape-text" placeholder="Chữ trong hình (tuỳ chọn)" aria-label="Chữ trong hình" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {SHAPE_GROUPS.map((group) => (
        <div key={group}>
          <div className="ribbon-menu-heading">{group}</div>
          <div className="insert-shape-grid">
            {SHAPES.filter((shape) => shape.group === group).map((shape) => (
              <button key={shape.id} type="button" className="shape-cell" title={shape.label} aria-label={shape.label} onClick={() => onPick({ id: shape.id, label: shape.label, fill, stroke, text })}>
                <img src={shapeDataUrl({ id: shape.id, fill, stroke })} alt="" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CoverGallery({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="insert-tiles">
      {COVER_STYLES.map((style) => (
        <button key={style.id} type="button" className="insert-cover-tile" title={style.label} onClick={() => onPick(style.id)}>
          <span className={`insert-cover-thumb ${style.dark ? 'dark' : ''}`} style={{ '--cover-accent': style.accent } as React.CSSProperties}>
            <span className="thumb-title" /><span className="thumb-sub" /><span className="thumb-foot" />
          </span>
          <span>{style.label}</span>
        </button>
      ))}
    </div>
  );
}

export function EquationGallery({ onPick }: { onPick: (latex: string) => void }) {
  const rendered = useMemo(() => BUILTIN_EQUATIONS.map((item) => ({ ...item, html: katex.renderToString(item.latex, { throwOnError: false, output: 'html' }) })), []);
  return (
    <div className="insert-equations">
      {rendered.map((item) => (
        <button key={item.id} type="button" className="insert-equation" title={item.label} onClick={() => onPick(item.latex)}>
          <strong>{item.label}</strong>
          <span dangerouslySetInnerHTML={{ __html: item.html }} />
        </button>
      ))}
    </div>
  );
}

export function SymbolGallery({ onPick }: { onPick: (symbol: string) => void }) {
  const symbols = useMemo(loadRecentSymbols, []);
  return (
    <div className="insert-symbol-grid">
      {symbols.map((symbol) => <button key={symbol} type="button" className="symbol-cell" aria-label={symbol} onClick={() => { pushRecentSymbol(symbol); onPick(symbol); }}>{symbol}</button>)}
    </div>
  );
}
