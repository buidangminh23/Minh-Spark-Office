import { createPortal } from 'react-dom';
import { useMemo } from 'react';
import { PRINT_ROOT_ID } from '../../lib/print/printRun';
import type { PrintSheet } from './printPages';
import type { OutputPage, PrintRun } from './printOutput';
import type { PrintBandText, PrintSettings, PrintSource } from './printTypes';
import { expandHeaderFooter } from '../../lib/print/headerFooter';

const today = () => new Date().toLocaleDateString('vi-VN');
const mm = (value: number) => `${value}mm`;
const hasText = (band?: PrintBandText) => Boolean(band && (band.left || band.center || band.right));

function CustomBand({ band, position, offset, margins, source, number, total }: { band: PrintBandText; position: 'top' | 'bottom'; offset: number; margins: { left: number; right: number }; source: PrintSource; number: number; total: number }) {
  const ctx = { page: number, pages: total, sheet: source.bands?.sheet ?? '', file: source.bands?.file ?? source.title, now: new Date() };
  return (
    <div className={`mp-band mp-band-${position} mp-band-custom`} style={{ [position]: mm(offset), left: mm(margins.left), right: mm(margins.right) }}>
      <span>{expandHeaderFooter(band.left, ctx)}</span>
      <span>{expandHeaderFooter(band.center, ctx)}</span>
      <span>{expandHeaderFooter(band.right, ctx)}</span>
    </div>
  );
}

export function PrintSheetView({ sheet, source, settings, number, total, guides = false }: { sheet: PrintSheet; source: PrintSource; settings: PrintSettings; number: number; total: number; guides?: boolean }) {
  const { margins, paper } = sheet;
  const bandTop = margins.top >= settings.headerMm + 3;
  const bandBottom = margins.bottom >= settings.footerMm + 3;
  const customHeader = hasText(source.bands?.header) ? source.bands?.header : undefined;
  const customFooter = hasText(source.bands?.footer) ? source.bands?.footer : undefined;
  const showHeader = bandTop && !customHeader && (settings.showTitle || settings.showDate) && !source.fixedPaper;
  const showFooter = bandBottom && !customFooter && settings.pageNumbers && !source.fixedPaper;
  return (
    <div
      className={`mp-sheet ${settings.grayscale ? 'is-gray' : ''}`}
      data-orientation={sheet.orientation}
      style={{ width: mm(paper.w), height: mm(paper.h) }}
    >
      {sheet.cells.map((cell) => {
        const item = source.items[cell.item];
        if (!item) return null;
        return (
          <div
            key={`${item.key}-${cell.part}`}
            className={`mp-cell ${settings.frame && source.kind === 'slide' ? 'is-framed' : ''}`}
            style={{ left: mm(cell.box.x), top: mm(cell.box.y), width: mm(cell.box.w), height: mm(cell.box.h) }}
          >
            <div className="mp-content" style={{ width: item.size.w, height: item.slicesSelf ? undefined : item.size.h, transform: `scale(${cell.scale})${item.slicesSelf ? '' : ` translateY(${-cell.offsetPx}px)`}` }}>
              {item.render({ offsetPx: cell.offsetPx, heightPx: cell.heightPx, part: cell.part })}
            </div>
          </div>
        );
      })}
      {showHeader && (
        <div className="mp-band mp-band-top" style={{ top: mm(settings.headerMm), left: mm(margins.left), right: mm(margins.right) }}>
          <span>{settings.showTitle ? source.title : ''}</span>
          <span>{settings.showDate ? today() : ''}</span>
        </div>
      )}
      {customHeader && bandTop && <CustomBand band={customHeader} position="top" offset={settings.headerMm} margins={margins} source={source} number={number} total={total} />}
      {customFooter && bandBottom && <CustomBand band={customFooter} position="bottom" offset={settings.footerMm} margins={margins} source={source} number={number} total={total} />}
      {showFooter && (
        <div className="mp-band mp-band-bottom" style={{ bottom: mm(settings.footerMm), left: mm(margins.left), right: mm(margins.right) }}>
          <span>Trang {number} / {total}</span>
        </div>
      )}
      {guides && (() => {
        const g = source.guideMargins ?? margins;
        return <div className="mp-guides" style={{ left: mm(g.left), top: mm(g.top), right: mm(g.right), bottom: mm(g.bottom) }} />;
      })()}
    </div>
  );
}


type SheetContext = { sheets: PrintSheet[]; source: PrintSource; settings: PrintSettings; total: number };

export function OutputPageView({ page, ctx, guides = false }: { page: OutputPage; ctx: SheetContext; guides?: boolean }) {
  const only = page.slots.length === 1 && page.slots[0].scale === 1 && !page.framed ? page.slots[0] : null;
  if (only) {
    return <PrintSheetView sheet={ctx.sheets[only.sheet]} source={ctx.source} settings={ctx.settings} number={only.sheet + 1} total={ctx.total} guides={guides} />;
  }
  return (
    <div className={`mp-sheet ${ctx.settings.grayscale ? 'is-gray' : ''}`} data-orientation={page.orientation} style={{ width: mm(page.paper.w), height: mm(page.paper.h) }}>
      {page.slots.map((slot) => {
        const sheet = ctx.sheets[slot.sheet];
        return (
          <div key={slot.sheet} className="mp-nup-slot" style={{ left: mm(slot.box.x), top: mm(slot.box.y), width: mm(slot.box.w), height: mm(slot.box.h) }}>
            <div className="mp-nup-inner" style={{ zoom: slot.scale }}>
              <PrintSheetView sheet={sheet} source={ctx.source} settings={{ ...ctx.settings, grayscale: false }} number={slot.sheet + 1} total={ctx.total} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BlankPage({ like }: { like: OutputPage | undefined }) {
  const paper = like?.paper ?? { w: 210, h: 297 };
  return <div className="mp-sheet" data-orientation={like?.orientation ?? 'portrait'} style={{ width: mm(paper.w), height: mm(paper.h) }} />;
}

export function PrintPortal({ run, ctx }: { run: PrintRun; ctx: SheetContext }) {
  const pages = run;
  const first = pages.find(Boolean) ?? undefined;
  const css = useMemo(() => {
    const sizes = new Map<string, string>();
    for (const page of pages) if (page) sizes.set(page.orientation, `${page.paper.w}mm ${page.paper.h}mm`);
    const named = [...sizes].map(([name, size]) => `@page mp-${name} { size: ${size}; margin: 0; }`).join(' ');
    const lead = first ? `@page { size: ${first.paper.w}mm ${first.paper.h}mm; margin: 0; }` : '';
    return `@media print { ${lead} ${named} }`;
  }, [pages, first]);
  return createPortal(
    <div id={PRINT_ROOT_ID} aria-hidden>
      <style>{css}</style>
      {pages.map((page, i) => (page ? <OutputPageView key={`${i}-${page.key}`} page={page} ctx={ctx} /> : <BlankPage key={`${i}-blank`} like={first ?? undefined} />))}
    </div>,
    document.body,
  );
}
