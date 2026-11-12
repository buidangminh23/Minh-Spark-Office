import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { PAGE_SIZES, type PageSettings } from '../../../lib/storage';
import { formatNote } from '../extensionsExtra';
import { useDoc } from '../DocContext';
import { getPagination, PAGE_GAP, pageGap, type PaginationResult } from '../pagination';
import { useSetting } from '../../../lib/appSettings';
import { regionZones } from '../pageFormat';
import { HorizontalRuler, VerticalRuler } from './Rulers';
import InkLayer from './InkLayer';
import { styleSheetCss } from '../docStyles';
import { LineNumberGutter, WatermarkMark } from '../layoutPaper';

const CM = 37.8;
const noteLabel = (page: PageSettings, number: number, indexOnPage: number) => formatNote(page.footnoteRestart === 'page' ? indexOnPage + 1 : number + (page.footnoteStart ?? 1) - 1, page.footnoteFormat ?? 'decimal');
const cssString = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ')}"`;

export const pageDimensions = (size: keyof typeof PAGE_SIZES, orientation: 'portrait' | 'landscape') => {
  const s = PAGE_SIZES[size];
  return orientation === 'landscape' ? { width: s.height, height: s.width } : { width: s.width, height: s.height };
};

export function PrintStyles() {
  const { page, title } = useDoc();
  const dims = pageDimensions(page.size, page.orientation);
  const m = page.margins;
  const toMm = (px: number) => `${(px / CM) * 10}mm`;
  const box = (content: string) => `content: ${content}; font: 9pt Arial, sans-serif; color: #6b7280;`;
  const flowing = (page.columns ?? 1) > 1;
  const css = flowing
    ? `@page { size: ${toMm(dims.width)} ${toMm(dims.height)}; margin: ${toMm(m.top)} ${toMm(m.right)} ${toMm(m.bottom)} ${toMm(m.left)};
${page.header ? `@top-center { ${box(cssString(page.header.replaceAll('\t', '   ')))} }` : ''}
${page.footer ? `@bottom-left { ${box(cssString(page.footer.replaceAll('\t', '   ')))} }` : ''}
${page.pageNumbers ? `@bottom-right { ${box(`"Trang " counter(page) " / " counter(pages)`)} }` : ''} }`
    : `@page { size: ${dims.width}px ${dims.height}px; margin: 0; }`;
  useEffect(() => {
    const previous = document.title;
    document.title = title.replace(/\.[^/.]+$/, '');
    return () => { document.title = previous; };
  }, [title]);
  return <style media="print">{css}</style>;
}

function MergePreviewStyles() {
  const { merge, mergePreview } = useDoc();
  if (!merge || mergePreview === null) return null;
  const row = merge.rows[mergePreview] ?? {};
  const css = merge.headers.map((h) => `.merge-preview-on .merge-field[data-merge-field=${cssString(h)}]::after { content: ${cssString(row[h] ?? '')}; }`).join('\n');
  return <style>{css}</style>;
}

function Region({ zones, kind, top, bottom, left, right, onEdit }: { zones: [string, string, string]; kind: 'header' | 'footer'; top?: number; bottom?: number; left: number; right: number; onEdit: () => void }) {
  return (
    <div className={`${kind}-region`} style={{ top, bottom, left, right }} title="Nhấp đúp để sửa" onDoubleClick={onEdit}>
      <span>{zones[0]}</span><span>{zones[1]}</span><span>{zones[2]}</span>
    </div>
  );
}

export function Paper({ onPages }: { onPages: (count: number, current: number) => void }) {
  const showPageGap = useSetting('docPageGap');
  const ctx = useDoc();
  const { editor, page, view, title } = ctx;
  const paperRef = useRef<HTMLDivElement | null>(null);
  const dims = pageDimensions(page.size, page.orientation);
  const viewPrint = view.viewMode === 'print';
  const side = viewPrint && view.pageMove === 'side';
  const paged = viewPrint && !side && (page.columns ?? 1) === 1;
  const [sidePages, setSidePages] = useState(1);
  const [layout, setLayout] = useState<PaginationResult>(() => getPagination(editor).result);
  useEffect(() => { getPagination(editor).refresh?.(); }, [editor, showPageGap]);
  const [flowPages, setFlowPages] = useState(1);
  const [current, setCurrent] = useState(1);
  const zoom = view.zoom / 100;
  const contentWidth = dims.width - page.margins.left - page.margins.right;

  useEffect(() => {
    const storage = getPagination(editor);
    storage.listeners.add(setLayout);
    return () => { storage.listeners.delete(setLayout); };
  }, [editor]);

  useEffect(() => {
    const storage = getPagination(editor);
    storage.config = paged ? { pageHeight: dims.height, marginTop: page.margins.top, marginBottom: page.margins.bottom, zoom, contentWidth, verticalAlign: page.verticalAlign } : null;
    storage.refresh();
  }, [editor, paged, dims.height, page.margins.top, page.margins.bottom, zoom, contentWidth, page.verticalAlign, page.styles, page.fontFamily, page.fontSize]);

  useEffect(() => {
    if (paged || !viewPrint || side) return;
    const content = paperRef.current?.querySelector('.paper-flow') as HTMLElement | null;
    if (!content) return;
    const measure = () => setFlowPages(Math.max(1, Math.ceil((content.offsetHeight + page.margins.top + page.margins.bottom) / dims.height)));
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, [paged, viewPrint, dims.height, page.margins.top, page.margins.bottom]);

  useEffect(() => {
    if (!side) return;
    const flow = editor.view.dom as HTMLElement;
    const measure = () => {
      const unit = flow.clientWidth / contentWidth || 1;
      const gap = (page.margins.left + page.margins.right + PAGE_GAP) * unit;
      setSidePages(Math.max(1, Math.round((flow.scrollWidth + gap) / (flow.clientWidth + gap))));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(flow);
    editor.on('update', measure);
    measure();
    return () => {
      observer.disconnect();
      editor.off('update', measure);
    };
  }, [editor, side, contentWidth, page.margins.left, page.margins.right, zoom]);

  const pages = paged ? layout.pages : side ? sidePages : viewPrint ? flowPages : 1;
  const span = dims.height + pageGap();

  useEffect(() => {
    const report = () => {
      const paper = paperRef.current;
      if (!paper || !editor.view.dom.isConnected) return;
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.head);
        const rect = paper.getBoundingClientRect();
        const offset = side ? (coords.left - rect.left) / zoom : (coords.top - rect.top) / zoom;
        const index = Math.min(pages, Math.max(1, Math.floor(offset / (side ? dims.width + PAGE_GAP : paged ? span : dims.height)) + 1));
        setCurrent(index);
        onPages(pages, index);
      } catch {
        onPages(pages, 1);
      }
    };
    report();
    editor.on('selectionUpdate', report);
    editor.on('update', report);
    return () => {
      editor.off('selectionUpdate', report);
      editor.off('update', report);
    };
  }, [editor, pages, paged, side, span, dims.height, dims.width, zoom, onPages]);

  const classes = [
    'doc-paper',
    `view-${view.viewMode}`,
    paged ? 'paged' : 'flowing',
    side ? 'page-side' : '',
    page.pageBorder && page.pageBorder !== 'none' ? `border-${page.pageBorder}` : '',
    view.showGrid ? 'show-grid' : '',
    view.showMarks ? 'show-marks' : '',
    (page.hyphenMode ?? (page.hyphenate ? 'auto' : 'none')) === 'auto' ? 'hyphenate' : (page.hyphenMode === 'manual' ? 'hyphen-manual' : 'hyphen-none'),
    page.effect && page.effect !== 'none' ? `effect-${page.effect}` : '',
    (page.columns ?? 1) > 1 ? 'multi-column' : '',
    page.mirrorMargins ? 'mirror-margins' : '',
    page.background && page.background !== 'none' ? `bg-${page.background}` : '',
    ctx.mergePreview !== null ? 'merge-preview-on' : '',
    view.inkTool ? 'inking' : '',
    `columns-${page.columns ?? 1}`,
  ].filter(Boolean).join(' ');

  const style = useMemo(() => ({
    width: side ? pages * dims.width + (pages - 1) * PAGE_GAP : viewPrint ? dims.width : undefined,
    height: side ? dims.height : paged ? `calc(${pages} * ${dims.height}px + ${pages - 1} * var(--page-gap))` : undefined,
    minHeight: viewPrint && !paged && !side ? pages * dims.height : undefined,
    background: paged || side ? 'transparent' : page.pageColor || '#ffffff',
    '--side-w': `${contentWidth}px`,
    '--side-h': `${dims.height - page.margins.top - page.margins.bottom}px`,
    '--side-gap': `${page.margins.left + page.margins.right + PAGE_GAP}px`,
    '--page-gap': `${side || showPageGap ? PAGE_GAP : 0}px`,
    fontFamily: page.fontFamily ? `"${page.fontFamily}", Arial, sans-serif` : undefined,
    fontSize: page.fontSize ? `${page.fontSize}pt` : undefined,
    '--page-height': `${dims.height}px`,
    '--page-margin-top': `${page.margins.top}px`,
    '--sheet-color': page.pageColor || '#ffffff',
    '--page-border-color': page.pageBorderColor || '#334155',
    '--page-border-width': `${page.pageBorderWidth ?? 2}px`,
    '--doc-columns': page.columns ?? 1,
    '--doc-column-gap': `${page.columnGap ?? 32}px`,
    '--doc-column-rule': page.columnLine === false ? 'none' : '1px solid #e1e5ee',
  }) as React.CSSProperties, [side, contentWidth, page.margins.bottom, page.margins.left, page.margins.right, viewPrint, paged, dims.height, dims.width, pages, page.pageColor, page.fontFamily, page.fontSize, page.margins.top, page.pageBorderColor, page.pageBorderWidth, page.columns, page.columnGap, page.columnLine, showPageGap]);

  const flowStyle: React.CSSProperties = viewPrint ? { padding: `${page.margins.top}px ${page.margins.right}px ${paged || side ? 0 : page.margins.bottom}px ${page.margins.left}px` } : {};
  const editHeaderFooter = () => ctx.openDialog('headerfooter');
  const headerTop = Math.max(12, page.margins.top / 2 - 10);
  const footerBottom = Math.max(12, page.margins.bottom / 2 - 10);
  const sheetTop = (index: number) => `calc(${index} * (${dims.height}px + var(--page-gap)))`;
  const sheetBox = (index: number): React.CSSProperties => (side ? { top: 0, left: index * (dims.width + PAGE_GAP), width: dims.width, height: dims.height } : { top: sheetTop(index), height: dims.height, ...(page.mirrorMargins && index % 2 === 1 ? { left: page.margins.left - page.margins.right, right: page.margins.right - page.margins.left } : {}) });
  const showSheets = paged || side;
  const styleCss = useMemo(() => styleSheetCss(page), [page]);

  return (
    <div className="paper-zoom" style={{ zoom }} onWheel={side ? (event) => { if (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.closest('.doc-canvas')?.scrollBy({ left: event.deltaY }); } : undefined}>
      <style>{styleCss}</style>
      <MergePreviewStyles />
      {view.showRuler && viewPrint && !side && <HorizontalRuler width={dims.width} />}
      <div ref={paperRef} className={classes} style={style}>
        {view.showRuler && paged && <VerticalRuler height={dims.height} top={(current - 1) * span} />}
        {showSheets && Array.from({ length: pages }, (_, i) => (
          <div key={i} className="page-sheet" style={sheetBox(i)} aria-hidden>
            <WatermarkMark page={page} />
          </div>
        ))}
        {showSheets && Array.from({ length: pages }, (_, i) => {
          const notes = paged ? layout.notes[i] ?? [] : [];
          return (
            <div key={i} className="page-chrome" style={sheetBox(i)}>
              <Region kind="header" zones={regionZones(page, 'header', i, pages, title.replace(/\.[^/.]+$/, ''))} top={headerTop} left={page.margins.left} right={page.margins.right} onEdit={editHeaderFooter} />
              {notes.length > 0 && (
                <div className="footnote-list" style={{ bottom: page.margins.bottom, left: page.margins.left, right: page.margins.right }}>
                  {notes.map((note, index) => <div key={note.number} className="footnote-item"><sup>{noteLabel(page, note.number, index)}</sup> {note.text}</div>)}
                </div>
              )}
              <Region kind="footer" zones={regionZones(page, 'footer', i, pages, title.replace(/\.[^/.]+$/, ''))} bottom={footerBottom} left={page.margins.left} right={page.margins.right} onEdit={editHeaderFooter} />
            </div>
          );
        })}
        {!paged && !side && viewPrint && Array.from({ length: pages - 1 }, (_, i) => (
          <div key={i} className="page-boundary" style={{ top: (i + 1) * dims.height }} aria-hidden><span>Trang {i + 2}</span></div>
        ))}
        {!paged && !side && <WatermarkMark page={page} flowing />}
        <div className="paper-flow" style={flowStyle}>
          <EditorContent editor={editor} />
        </div>
        <LineNumberGutter />
        {viewPrint && !view.hideInk && <InkLayer pageSpan={paged ? span : 0} />}
      </div>
    </div>
  );
}
