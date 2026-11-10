import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { File, RectangleHorizontal, RectangleVertical } from 'lucide-react';
import type { PageSettings } from '../../../lib/storage';
import { PAPER_CATALOG, PAPER_GROUP_LABELS, PAPER_KEYS } from '../../../lib/paperSizes';
import { MARGIN_PRESETS, looksAdministrative, presetMargins, pxToMm, recommendDocumentMargins, sameMargins, type Margins } from '../../../lib/print/printLayout';
import { CmField, MarginGallery, type MarginChoice } from '../../../components/print/MarginGallery';
import { OptionCard } from '../../../components/print/OptionCard';
import { WORD_PRESETS } from '../../../components/print/PrintLayoutControls';
import { PrintDialog } from '../../../components/print/PrintDialog';
import type { PrintSource } from '../../../components/print/printTypes';
import { useDoc } from '../DocContext';
import { getPagination, pageAtPos, type PaginationResult } from '../pagination';
import { pageDimensions } from './Paper';

const PX_PER_MM = 3.78;
const toPx = (mm: number) => Math.round(mm * PX_PER_MM * 10) / 10;
const toMm = (px: number) => Math.round((px / PX_PER_MM) * 10) / 10;
const OBJECT_SELECTOR = '.tiptap table, .tiptap img, .tiptap .doc-textbox, .tiptap figure, .tiptap svg';
const PRUNE_PAD = 80;
const MARGIN_KEYS: (keyof Margins)[] = ['top', 'bottom', 'left', 'right'];
const LAST_KEY = 'minh-doc-last-margins';

type LastCustom = { margins: Margins; mirror: boolean };

const paperSubtitle = (w: number, h: number) => `${String(Math.round(w) / 10).replace('.', ',')} cm × ${String(Math.round(h) / 10).replace('.', ',')} cm`;

const readLast = (): LastCustom | null => {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as LastCustom) : null;
  } catch {
    return null;
  }
};

const writeLast = (value: LastCustom) => {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(value));
  } catch {
    return;
  }
};

const livePaper = () => document.querySelector<HTMLElement>('.doc-editor .doc-paper.paged');

function isPrintOnly(media: string) {
  const text = media.toLowerCase();
  return text.includes('print') && !text.includes('screen');
}

function collectRules(rules: CSSRuleList, out: string[]) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule) {
      if (isPrintOnly(rule.media.mediaText)) continue;
      out.push(`@media ${rule.media.mediaText} {`);
      collectRules(rule.cssRules, out);
      out.push('}');
    } else if (!(rule instanceof CSSImportRule) && !(rule instanceof CSSFontFaceRule) && !(rule instanceof CSSPageRule)) {
      out.push(rule.cssText);
    }
  }
}

function screenStyleSheet(): CSSStyleSheet {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.media.mediaText && isPrintOnly(sheet.media.mediaText)) continue;
    try {
      collectRules(sheet.cssRules, parts);
    } catch {
      continue;
    }
  }
  const result = new CSSStyleSheet();
  result.replaceSync(parts.join('\n'));
  return result;
}

function pruneFlow(paper: HTMLElement, clone: HTMLElement, pageTop: number, height: number) {
  const liveFlow = paper.querySelector<HTMLElement>('.tiptap');
  const flow = clone.querySelector<HTMLElement>('.tiptap');
  if (!liveFlow || !flow || liveFlow.children.length !== flow.children.length) return;
  const origin = paper.getBoundingClientRect().top;
  const live = Array.from(liveFlow.children) as HTMLElement[];
  const copies = Array.from(flow.children) as HTMLElement[];
  const keep = live.map((child) => {
    const rect = child.getBoundingClientRect();
    return rect.bottom - origin >= pageTop - PRUNE_PAD && rect.top - origin <= pageTop + height + PRUNE_PAD;
  });
  const firstKept = keep.indexOf(true);
  if (firstKept < 0) return;
  if (firstKept > 0) {
    const target = live[firstKept];
    const marginTop = parseFloat(getComputedStyle(target).marginTop) || 0;
    const padding = parseFloat(getComputedStyle(liveFlow).paddingTop) || 0;
    const spacer = document.createElement('div');
    spacer.style.height = `${target.getBoundingClientRect().top - liveFlow.getBoundingClientRect().top - padding - marginTop}px`;
    flow.insertBefore(spacer, copies[firstKept]);
  }
  copies.forEach((node, i) => { if (!keep[i]) node.remove(); });
}

function pageClone(paper: HTMLElement, index: number, pageTop: number, height: number): HTMLElement {
  const clone = paper.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[contenteditable]').forEach((node) => node.setAttribute('contenteditable', 'false'));
  clone.querySelectorAll('[data-placeholder]').forEach((node) => { node.removeAttribute('data-placeholder'); node.classList.remove('is-editor-empty', 'is-empty'); });
  clone.querySelectorAll('.doc-ruler-v, .selection-bubble, .doc-object-handle, [data-resize-handle], .column-resize-handle').forEach((node) => node.remove());
  clone.querySelectorAll(':scope > .page-sheet').forEach((sheet, i) => { if (i !== index) sheet.remove(); });
  pruneFlow(paper, clone, pageTop, height);
  clone.style.margin = `${-pageTop}px 0 0 0`;
  clone.style.height = `${pageTop + height}px`;
  clone.style.minHeight = '0';
  clone.style.overflow = 'hidden';
  clone.style.boxShadow = 'none';
  clone.style.pointerEvents = 'none';
  return clone;
}

function DocPageClone({ index, version, width, height, sheet }: { index: number; version: number; width: number; height: number; sheet: () => CSSStyleSheet }) {
  const host = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const target = host.current;
    const paper = livePaper();
    if (!target || !paper) return;
    const sheets = paper.querySelectorAll<HTMLElement>(':scope > .page-sheet');
    const top = sheets[index]?.offsetTop ?? index * height;
    const root = target.shadowRoot ?? target.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet()];
    const frame = document.createElement('div');
    frame.className = 'doc-editor';
    frame.style.cssText = `display:block;position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#fff;padding:0;margin:0;min-height:0`;
    frame.appendChild(pageClone(paper, index, top, height));
    root.replaceChildren(frame);
  }, [index, version, height, width, sheet]);
  return <div ref={host} style={{ width, height }} />;
}

function measureWidestObjectPx() {
  const paper = livePaper();
  if (!paper) return 0;
  return Array.from(paper.querySelectorAll<HTMLElement>(OBJECT_SELECTOR)).reduce((max, el) => Math.max(max, el.scrollWidth, el.getBoundingClientRect().width), 0);
}

function presetOf(margins: Margins, mirror: boolean, gutter: number): MarginChoice {
  if (gutter > 0.2) return 'custom';
  const hit = WORD_PRESETS.find((key) => {
    const def = MARGIN_PRESETS[key];
    return sameMargins(presetMargins(key), margins, 0.6) && ('mirror' in def && Boolean(def.mirror)) === mirror;
  });
  return hit ?? 'custom';
}

export function DocPrintDialog({ onClose }: { onClose: () => void }) {
  const { editor, page, setPage, view, setView, title, openDialog } = useDoc();
  const [result, setResult] = useState<PaginationResult>(() => getPagination(editor).result);
  const [version, setVersion] = useState(0);
  const [binding, setBinding] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [lastCustom, setLastCustom] = useState<LastCustom | null>(readLast);
  const restore = useRef({ zoom: view.zoom, viewMode: view.viewMode, pageMove: view.pageMove });
  const sheetCache = useRef<CSSStyleSheet | null>(null);
  const screenSheet = useCallback(() => (sheetCache.current ??= screenStyleSheet()), []);

  useEffect(() => {
    const saved = restore.current;
    setView({ zoom: 100, viewMode: 'print', pageMove: 'vertical' });
    return () => setView({ zoom: saved.zoom, viewMode: saved.viewMode, pageMove: saved.pageMove });
  }, [setView]);

  useEffect(() => {
    const storage = getPagination(editor);
    const listener = (next: PaginationResult) => {
      setResult(next);
      requestAnimationFrame(() => setVersion((v) => v + 1));
    };
    storage.listeners.add(listener);
    const bump = () => setVersion((v) => v + 1);
    editor.on('update', bump);
    return () => {
      storage.listeners.delete(listener);
      editor.off('update', bump);
    };
  }, [editor]);

  const dims = pageDimensions(page.size, page.orientation);
  const paperMm = useMemo(() => ({ w: pxToMm(dims.width), h: pxToMm(dims.height) }), [dims.width, dims.height]);
  const current = useMemo(() => {
    try { return result.pages > 0 ? pageAtPos(editor, editor.state.selection.head) - 1 : 0; } catch { return 0; }
  }, [editor, result]);

  const source: PrintSource = useMemo(() => ({
    kind: 'document',
    title: title.replace(/\.[^/.]+$/, ''),
    fixedPaper: { size: paperMm, landscape: page.orientation === 'landscape' },
    guideMargins: { top: pxToMm(page.margins.top), right: pxToMm(page.margins.right), bottom: pxToMm(page.margins.bottom), left: pxToMm(page.margins.left) },
    currentItem: current,
    loading: view.zoom !== 100 || view.viewMode !== 'print',
    items: Array.from({ length: Math.max(1, result.pages) }, (_, i) => ({
      key: `doc-${i}`,
      size: { w: dims.width, h: dims.height },
      render: () => <DocPageClone index={i} version={version} width={dims.width} height={dims.height} sheet={screenSheet} />,
    })),
  }), [title, paperMm, page.orientation, page.margins, current, view.zoom, view.viewMode, result.pages, dims.width, dims.height, version, screenSheet]);

  const gutterMm = toMm(page.gutter ?? 0);
  const mirror = Boolean(page.mirrorMargins);
  const marginsMm: Margins = { top: toMm(page.margins.top), right: toMm(page.margins.right), bottom: toMm(page.margins.bottom), left: Math.max(0, toMm(page.margins.left) - gutterMm) };
  const choice: MarginChoice = showCustom ? 'custom' : presetOf(marginsMm, mirror, gutterMm);
  const names: Record<keyof Margins, string> = { top: 'Trên', bottom: 'Dưới', left: mirror ? 'Trong' : 'Trái', right: mirror ? 'Ngoài' : 'Phải' };

  const applyMargins = (mm: Margins, options: { mirror?: boolean; gutter?: number } = {}) => {
    const gutter = options.gutter ?? gutterMm;
    setPage({
      margins: { top: toPx(mm.top), right: toPx(mm.right), bottom: toPx(mm.bottom), left: toPx(mm.left + gutter) },
      gutter: toPx(gutter),
      mirrorMargins: options.mirror ?? mirror,
    });
  };

  const editCustom = (mm: Margins, options: { mirror?: boolean; gutter?: number } = {}) => {
    applyMargins(mm, options);
    const next = { margins: mm, mirror: options.mirror ?? mirror };
    writeLast(next);
    setLastCustom(next);
  };

  const autoAlign = () => {
    const advice = recommendDocumentMargins({
      paper: paperMm,
      margins: marginsMm,
      widestObjectMm: pxToMm(measureWidestObjectPx()),
      administrative: looksAdministrative(editor.getText()),
      binding,
    });
    setShowCustom(false);
    applyMargins(advice.margins, { gutter: 0 });
    if (advice.landscape && page.orientation === 'portrait') {
      setPage({ orientation: 'landscape' });
      advice.notes.push('Đã chuyển sang khổ ngang');
    }
    setNotes(advice.notes);
  };

  const pickMargins = (picked: MarginChoice) => {
    if (picked === 'auto') return autoAlign();
    if (picked === 'custom') return setShowCustom(true);
    if (picked === 'last') {
      if (lastCustom) applyMargins(lastCustom.margins, { mirror: lastCustom.mirror, gutter: 0 });
      return setShowCustom(true);
    }
    setShowCustom(false);
    const def = MARGIN_PRESETS[picked];
    applyMargins(presetMargins(picked), { mirror: 'mirror' in def && Boolean(def.mirror), gutter: 0 });
  };

  const paperCard = (
    <OptionCard
      label="Khổ giấy"
      icon={<File size={20} />}
      title={PAPER_CATALOG[page.size].name}
      subtitle={paperSubtitle(PAPER_CATALOG[page.size].w, PAPER_CATALOG[page.size].h)}
      options={PAPER_KEYS.map((key) => ({ value: key, title: PAPER_CATALOG[key].name, subtitle: paperSubtitle(PAPER_CATALOG[key].w, PAPER_CATALOG[key].h), group: PAPER_GROUP_LABELS[PAPER_CATALOG[key].group] }))}
      value={page.size}
      onChange={(size) => setPage({ size: size as PageSettings['size'] })}
    />
  );

  const orientationCard = (
    <OptionCard
      label="Hướng giấy"
      icon={page.orientation === 'landscape' ? <RectangleHorizontal size={20} /> : <RectangleVertical size={20} />}
      title={page.orientation === 'landscape' ? 'Hướng ngang' : 'Hướng dọc'}
      options={[{ value: 'portrait', title: 'Hướng dọc', icon: <RectangleVertical size={20} /> }, { value: 'landscape', title: 'Hướng ngang', icon: <RectangleHorizontal size={20} /> }]}
      value={page.orientation}
      onChange={(orientation) => setPage({ orientation: orientation as PageSettings['orientation'] })}
    />
  );

  const marginCard = (
    <>
      <MarginGallery value={choice} presets={WORD_PRESETS} current={marginsMm} mirror={mirror} lastCustom={lastCustom} allowAuto onPick={pickMargins} />
      {choice === 'custom' && (
        <div className="mp-custom-margins">
          <div className="mp-margin-grid">
            {MARGIN_KEYS.map((key) => (
              <CmField key={key} label={names[key]} mm={marginsMm[key]} onChange={(value) => editCustom({ ...marginsMm, [key]: value })} />
            ))}
            <CmField label="Lề gáy" mm={gutterMm} onChange={(value) => editCustom(marginsMm, { gutter: value })} />
          </div>
          <label className="mp-check"><input type="checkbox" checked={mirror} onChange={(e) => editCustom(marginsMm, { mirror: e.target.checked })} /><span>Lề đối xứng khi in hai mặt</span></label>
        </div>
      )}
    </>
  );

  const extra = (
    <>
      <h3>Tự căn lề</h3>
      <label className="mp-check"><input type="checkbox" checked={binding} onChange={(e) => setBinding(e.target.checked)} /><span>Chừa 1 cm lề gáy để đóng quyển</span></label>
    </>
  );

  return (
    <PrintDialog
      source={source}
      onClose={onClose}
      cards={{ paper: paperCard, orientation: orientationCard, margins: marginCard }}
      extraOptions={extra}
      autoNotes={notes}
      onPageSetup={() => openDialog('pagesetup')}
    />
  );
}
