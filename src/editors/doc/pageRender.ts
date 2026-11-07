import type { DocCtx } from './DocContext';
import { getPagination } from './pagination';
import { pageDimensions } from './ui/Paper';

export type PageImage = { blob: Blob; mime: string; pixelWidth: number; pixelHeight: number; cssWidth: number; cssHeight: number };
export type PageRect = { page: number; x: number; y: number; w: number; h: number };
export type TextRun = PageRect & { text: string };
export type LinkRun = PageRect & { href: string };
export type PageLayout = { paper: HTMLElement; pages: number; width: number; height: number; gap: number };

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const settle = async (frames: number) => {
  for (let i = 0; i < frames; i += 1) await nextFrame();
};

const FRAME_LIMIT = 30;
const EXPORT_CSS = `
.page-sheet { box-shadow: none !important; }
.doc-ruler, .doc-ruler-v, .page-boundary { visibility: hidden !important; }
.comment-anchor { background: none !important; border-color: transparent !important; }
.search-hit, .search-hit.current { background: none !important; color: inherit !important; }
.merge-field, .smart-chip { background: none !important; border-color: transparent !important; color: inherit !important; }
.doc-bookmark, .doc-index-mark, .column-resize-handle, [data-resize-handle] { visibility: hidden !important; }
.tiptap .page-break { border-color: transparent !important; background: none !important; }
.tiptap .page-break::after { visibility: hidden !important; }
.doc-toc:hover { background: none !important; }
`;

export async function withPageLayout<T>(ctx: DocCtx, task: (layout: PageLayout) => Promise<T>): Promise<T> {
  const previous = { zoom: ctx.view.zoom, viewMode: ctx.view.viewMode, inkTool: ctx.view.inkTool };
  ctx.setView({ zoom: 100, viewMode: 'print', inkTool: null });
  try {
    let paper: HTMLElement | null = null;
    for (let i = 0; i < FRAME_LIMIT && !paper; i += 1) {
      await nextFrame();
      paper = document.querySelector<HTMLElement>('.doc-paper.view-print');
    }
    if (!paper) throw new Error('Không tìm thấy trang giấy.');
    await settle(2);
    getPagination(ctx.editor).runNow();
    await settle(3);
    const dims = pageDimensions(ctx.page.size, ctx.page.orientation);
    const gap = paper.classList.contains('paged') ? parseFloat(getComputedStyle(paper).getPropertyValue('--page-gap')) || 0 : 0;
    const pages = Math.max(1, paper.querySelectorAll('.page-sheet').length);
    return await task({ paper, pages, width: dims.width, height: dims.height, gap });
  } finally {
    ctx.setView(previous);
  }
}

const usedInWrapper = (selector: string, wrapper: HTMLElement) => {
  if (/(^|[\s,])(:root|html|body)\b/.test(selector)) return true;
  const plain = selector.replace(/::?[a-zA-Z-]+(\((?:[^()]|\([^()]*\))*\))?/g, '').trim();
  if (!plain || /[>+~,]$/.test(plain)) return true;
  try {
    return Boolean(wrapper.querySelector(plain));
  } catch {
    return true;
  }
};

const keptRules = (rules: CSSRuleList, wrapper: HTMLElement, fonts: CSSFontFaceRule[]): string => {
  let css = '';
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (usedInWrapper(rule.selectorText, wrapper)) css += `${rule.cssText}\n`;
    } else if (rule instanceof CSSFontFaceRule) {
      fonts.push(rule);
    } else if (rule instanceof CSSMediaRule) {
      if (window.matchMedia(rule.conditionText).matches && !/print/.test(rule.conditionText)) css += keptRules(rule.cssRules, wrapper, fonts);
    } else if (rule instanceof CSSSupportsRule || rule instanceof CSSLayerBlockRule) {
      css += keptRules(rule.cssRules, wrapper, fonts);
    }
  }
  return css;
};

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error('Không đọc được tệp.'));
  reader.readAsDataURL(blob);
});

const inlineFont = async (rule: CSSFontFaceRule) => {
  const base = rule.parentStyleSheet?.href ?? window.location.href;
  const match = /url\("?([^")]+\.woff2[^")]*)"?\)/.exec(rule.cssText) ?? /url\("?([^")]+)"?\)/.exec(rule.cssText);
  if (!match) return '';
  const family = rule.style.getPropertyValue('font-family');
  const weight = rule.style.getPropertyValue('font-weight') || 'normal';
  const style = rule.style.getPropertyValue('font-style') || 'normal';
  try {
    const response = await fetch(new URL(match[1], base));
    if (!response.ok) return '';
    return `@font-face { font-family: ${family}; font-weight: ${weight}; font-style: ${style}; src: url("${await blobToDataUrl(await response.blob())}"); }\n`;
  } catch {
    return '';
  }
};

const inlineRemoteImages = async (root: HTMLElement) => {
  const images = Array.from(root.querySelectorAll('img')).filter((img) => /^https?:/i.test(img.getAttribute('src') ?? ''));
  await Promise.all(images.map(async (img) => {
    try {
      const response = await fetch(img.src);
      if (response.ok) img.setAttribute('src', await blobToDataUrl(await response.blob()));
    } catch {
      img.removeAttribute('srcset');
    }
  }));
};

const buildClone = (layout: PageLayout) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'doc-editor';
  const block = `display:block;height:auto;min-height:0;overflow:visible;padding:0;margin:0;background:none;width:${layout.width}px;`;
  wrapper.setAttribute('style', block);
  wrapper.innerHTML = `<div class="doc-workspace" style="${block}"><div class="doc-canvas" style="${block}"><div class="paper-zoom" style="${block}"></div></div></div>`;
  const clone = layout.paper.cloneNode(true) as HTMLElement;
  clone.classList.remove('show-grid', 'show-marks', 'inking');
  clone.style.setProperty('--page-gap', '0px');
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.querySelectorAll('[contenteditable]').forEach((node) => node.removeAttribute('contenteditable'));
  clone.querySelectorAll('.ProseMirror-selectednode').forEach((node) => node.classList.remove('ProseMirror-selectednode'));
  clone.querySelectorAll('.doc-ruler, .doc-ruler-v, .ProseMirror-gapcursor').forEach((node) => node.remove());
  wrapper.querySelector('.paper-zoom')?.append(clone);
  return { wrapper, clone };
};

const pageSvgUrl = async (layout: PageLayout) => {
  const { wrapper, clone } = buildClone(layout);
  await inlineRemoteImages(clone);
  const holder = document.createElement('div');
  holder.append(wrapper);
  const fonts: CSSFontFaceRule[] = [];
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css += keptRules(sheet.cssRules, holder, fonts);
    } catch {
      continue;
    }
  }
  const families = clone.querySelector('.katex') ? fonts.filter((rule) => /KaTeX/.test(rule.style.getPropertyValue('font-family'))) : [];
  const fontCss = (await Promise.all(families.map(inlineFont))).join('');
  const inherited = getComputedStyle(layout.paper);
  wrapper.style.fontFamily = inherited.fontFamily;
  wrapper.style.color = inherited.color;
  const totalHeight = layout.pages * layout.height;
  const safeCss = `${fontCss}${css}${EXPORT_CSS}`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const xhtml = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${totalHeight}" viewBox="0 0 ${layout.width} ${totalHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${safeCss}</style>${xhtml}</div></foreignObject></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Trình duyệt không dựng được hình trang.'));
  image.src = url;
});

export async function renderPages(layout: PageLayout, options: { scale: number; mime: string; quality?: number; onProgress?: (done: number, total: number) => void }): Promise<PageImage[]> {
  const image = await loadImage(await pageSvgUrl(layout));
  await image.decode().catch(() => undefined);
  const results: PageImage[] = [];
  for (let index = 0; index < layout.pages; index += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.width * options.scale);
    canvas.height = Math.round(layout.height * options.scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không tạo được vùng vẽ.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, index * layout.height, layout.width, layout.height, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.mime, options.quality));
    if (!blob) throw new Error('Không xuất được hình trang.');
    results.push({ blob, mime: blob.type, pixelWidth: canvas.width, pixelHeight: canvas.height, cssWidth: layout.width, cssHeight: layout.height });
    options.onProgress?.(index + 1, layout.pages);
    await nextFrame();
  }
  return results;
}

const toPageRect = (rect: DOMRect, origin: DOMRect, layout: PageLayout): PageRect | null => {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const span = layout.height + layout.gap;
  const top = rect.top - origin.top;
  const page = Math.floor(top / span);
  if (page < 0 || page >= layout.pages) return null;
  return { page, x: rect.left - origin.left, y: top - page * span, w: rect.width, h: rect.height };
};

const SKIPPED_TEXT = '.katex, .doc-ruler, .doc-ruler-v, .page-boundary, .doc-index-mark, .doc-bookmark, .page-sheet';

const textNodes = (root: Element) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (node.nodeValue?.trim() && parent && !parent.closest(SKIPPED_TEXT)) nodes.push(node as Text);
  }
  return nodes;
};

const runsOfNode = (node: Text, origin: DOMRect, layout: PageLayout) => {
  const runs: TextRun[] = [];
  const range = document.createRange();
  const value = node.nodeValue ?? '';
  let current: TextRun | null = null;
  for (const match of value.matchAll(/\S+\s*/g)) {
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].trimEnd().length);
    const rect = toPageRect(range.getBoundingClientRect(), origin, layout);
    if (!rect) continue;
    if (current && current.page === rect.page && Math.abs(current.y - rect.y) < rect.h / 2) {
      current.w = rect.x + rect.w - current.x;
      current.text += match[0].replace(/\s+/g, ' ');
    } else {
      current = { ...rect, text: match[0].replace(/\s+/g, ' ') };
      runs.push(current);
    }
  }
  return runs;
};

export function collectTextRuns(layout: PageLayout): TextRun[] {
  const origin = layout.paper.getBoundingClientRect();
  const roots = Array.from(layout.paper.querySelectorAll('.paper-flow, .page-chrome'));
  return roots.flatMap(textNodes).flatMap((node) => runsOfNode(node, origin, layout));
}

export function collectLinks(layout: PageLayout): LinkRun[] {
  const origin = layout.paper.getBoundingClientRect();
  const links: LinkRun[] = [];
  layout.paper.querySelectorAll<HTMLAnchorElement>('.paper-flow a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    if (!/^(https?:|mailto:)/i.test(href)) return;
    Array.from(anchor.getClientRects()).forEach((rect) => {
      const area = toPageRect(rect, origin, layout);
      if (area) links.push({ ...area, href });
    });
  });
  return links;
}
