import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditorState } from '@tiptap/react';
import { PAGE_SIZES } from '../../../lib/storage';
import { useDoc } from '../DocContext';

const CM = 37.8;
const cssString = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ')}"`;

export const pageDimensions = (size: keyof typeof PAGE_SIZES, orientation: 'portrait' | 'landscape') => {
  const s = PAGE_SIZES[size];
  return orientation === 'landscape' ? { width: s.height, height: s.width } : { width: s.width, height: s.height };
};

function Ruler({ width, left, right }: { width: number; left: number; right: number }) {
  const ticks = Math.floor(width / CM);
  return (
    <div className="doc-ruler" style={{ width }} aria-hidden>
      <div className="ruler-margin" style={{ width: left }} />
      <div className="ruler-margin right" style={{ width: right }} />
      {Array.from({ length: ticks * 2 + 1 }, (_, i) => {
        const x = (i * CM) / 2;
        const cm = (x - left) / CM;
        return <div key={i} className={`ruler-tick ${i % 2 ? 'half' : ''}`} style={{ left: x }}>{i % 2 === 0 && Math.round(cm) !== 0 ? Math.abs(Math.round(cm)) : ''}</div>;
      })}
    </div>
  );
}

export function PrintStyles() {
  const { page, title } = useDoc();
  const dims = pageDimensions(page.size, page.orientation);
  const m = page.margins;
  const toMm = (px: number) => `${(px / CM) * 10}mm`;
  const box = (content: string) => `content: ${content}; font: 9pt Arial, sans-serif; color: #6b7280;`;
  const css = `@page { size: ${toMm(dims.width)} ${toMm(dims.height)}; margin: ${toMm(m.top)} ${toMm(m.right)} ${toMm(m.bottom)} ${toMm(m.left)};
${page.header ? `@top-center { ${box(cssString(page.header))} }` : ''}
${page.footer ? `@bottom-left { ${box(cssString(page.footer))} }` : ''}
${page.pageNumbers ? `@bottom-right { ${box(`"Trang " counter(page) " / " counter(pages)`)} }` : ''} }
${page.differentFirstPage ? '@page :first { @top-center { content: none } @bottom-left { content: none } @bottom-right { content: none } }' : ''}`;
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

export function Paper({ onPages }: { onPages: (count: number, current: number) => void }) {
  const ctx = useDoc();
  const { editor, page, view } = ctx;
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const dims = pageDimensions(page.size, page.orientation);
  const print = view.viewMode === 'print';
  const footnotes = useEditorState({ editor, selector: ({ editor: e }) => {
    const list: string[] = [];
    e.state.doc.descendants((node) => { if (node.type.name === 'footnote') list.push(String(node.attrs.text)); });
    return list;
  }, equalityFn: (a, b) => a.join('\u0000') === (b ?? []).join('\u0000') });

  useEffect(() => {
    const paper = paperRef.current;
    const content = paper?.querySelector('.paper-flow') as HTMLElement | null;
    if (!paper || !content) return;
    const measure = () => {
      const used = content.offsetHeight + page.margins.top + page.margins.bottom;
      setPageCount(print ? Math.max(1, Math.ceil(used / dims.height)) : 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, [print, dims.height, page.margins.top, page.margins.bottom]);

  useEffect(() => {
    const report = () => {
      const paper = paperRef.current;
      if (!paper || !editor.view.dom.isConnected) return;
      try {
        const zoom = view.zoom / 100;
        const caret = editor.view.coordsAtPos(editor.state.selection.head).top;
        const offset = (caret - paper.getBoundingClientRect().top) / zoom;
        onPages(pageCount, Math.min(pageCount, Math.max(1, Math.floor(offset / dims.height) + 1)));
      } catch {
        onPages(pageCount, 1);
      }
    };
    report();
    editor.on('selectionUpdate', report);
    editor.on('update', report);
    return () => {
      editor.off('selectionUpdate', report);
      editor.off('update', report);
    };
  }, [editor, pageCount, dims.height, view.zoom, onPages]);

  const classes = [
    'doc-paper',
    `view-${view.viewMode}`,
    page.pageBorder && page.pageBorder !== 'none' ? `border-${page.pageBorder}` : '',
    view.showGrid ? 'show-grid' : '',
    view.showMarks ? 'show-marks' : '',
    page.lineNumbers ? 'line-numbers' : '',
    page.hyphenate ? 'hyphenate' : '',
    ctx.mergePreview !== null ? 'merge-preview-on' : '',
    `columns-${page.columns ?? 1}`,
  ].filter(Boolean).join(' ');

  const style = useMemo(() => ({
    width: view.viewMode === 'print' ? dims.width : undefined,
    minHeight: print ? pageCount * dims.height : undefined,
    padding: view.viewMode === 'print' ? `${page.margins.top}px ${page.margins.right}px ${page.margins.bottom}px ${page.margins.left}px` : undefined,
    background: page.pageColor || '#ffffff',
    fontFamily: page.fontFamily ? `"${page.fontFamily}", Arial, sans-serif` : undefined,
    fontSize: page.fontSize ? `${page.fontSize}pt` : undefined,
    '--page-height': `${dims.height}px`,
  }) as React.CSSProperties, [view.viewMode, dims, print, pageCount, page]);

  return (
    <div className="paper-zoom" style={{ zoom: view.zoom / 100 }}>
      <MergePreviewStyles />
      {view.showRuler && print && <Ruler width={dims.width} left={page.margins.left} right={page.margins.right} />}
      <div ref={paperRef} className={classes} style={style}>
        {print && Array.from({ length: pageCount - 1 }, (_, i) => (
          <div key={i} className="page-boundary" style={{ top: (i + 1) * dims.height }} aria-hidden><span>Trang {i + 2}</span></div>
        ))}
        {print && Array.from({ length: pageCount }, (_, i) => <div key={i} className="page-sheet" style={{ top: i * dims.height, height: dims.height }} aria-hidden />)}
        {page.watermark && Array.from({ length: print ? pageCount : 1 }, (_, i) => (
          <div key={i} className="doc-watermark" style={{ top: print ? i * dims.height + dims.height / 2 : '40%' }} aria-hidden>{page.watermark}</div>
        ))}
        {page.header && print && !page.differentFirstPage && <div className="header-region" style={{ top: Math.max(12, page.margins.top / 2 - 10), left: page.margins.left, right: page.margins.right }}>{page.header}</div>}
        <div className="paper-flow">
          <EditorContent editor={editor} />
          {footnotes.length > 0 && (
            <div className="footnote-list">
              {footnotes.map((text, i) => <div key={i} className="footnote-item"><sup>{i + 1}</sup> {text}</div>)}
            </div>
          )}
        </div>
        {print && (page.footer || page.pageNumbers) && (
          <div className="footer-region" style={{ bottom: Math.max(12, page.margins.bottom / 2 - 10), left: page.margins.left, right: page.margins.right }}>
            <span>{page.footer}</span>
            {page.pageNumbers && <span>{pageCount} trang</span>}
          </div>
        )}
      </div>
    </div>
  );
}
