import type { JSONContent } from '@tiptap/react';
import type { PageImage, TextRun } from '../editors/doc/pageRender';
import { checkConversionAbort, type ConversionFile, type ConversionOptions } from './conversionTypes';
import { conversionNodeText } from './officeConversionDocument';
import { conversionTableGrid } from './officeConversionTables';

const WIDTH = 794;
const HEIGHT = 1123;
const MARGIN = 64;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const BOTTOM = HEIGHT - MARGIN;
const SCALE = 1.5;
const MAX_PAGES = 200;

export function wrapConversionText(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const lines: string[] = [];
  for (const source of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const word of source.match(/\S+\s*|\s+/g) ?? ['']) {
      if (line && measure(line + word) > maxWidth) { lines.push(line.trimEnd()); line = ''; }
      if (measure(word) <= maxWidth) { line += word; continue; }
      for (const character of word) {
        if (line && measure(line + character) > maxWidth) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function canvasBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob || blob.type !== mime) reject(new Error(`Trình duyệt không tạo được ảnh ${mime}.`));
    else resolve(blob);
  }, mime, 0.92));
}

async function loadImage(src: string, options: ConversionOptions): Promise<HTMLImageElement> {
  checkConversionAbort(options);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const clear = () => { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
    const abort = () => { clear(); image.src = ''; reject(new DOMException('Đã dừng chuyển đổi.', 'AbortError')); };
    const timeout = setTimeout(() => { clear(); image.src = ''; reject(new Error('Không đọc được ảnh nhúng trong thời gian cho phép.')); }, 15_000);
    image.onload = () => { clear(); resolve(image); };
    image.onerror = () => { clear(); reject(new Error('Ảnh nhúng bị hỏng hoặc không được trình duyệt hỗ trợ.')); };
    options.signal?.addEventListener('abort', abort, { once: true });
    image.src = src;
  });
}

export async function renderConversionDocument(json: JSONContent, base: string, target: string, options: ConversionOptions): Promise<ConversionFile[]> {
  if (typeof document === 'undefined') throw new Error('Chức năng xuất trang cần trình duyệt.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * SCALE);
  canvas.height = Math.round(HEIGHT * SCALE);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Không tạo được vùng vẽ trang.');
  const ctx = context;
  const mime = target === 'png' || target === 'pdf' ? 'image/png' : target === 'jpg' ? 'image/jpeg' : 'image/webp';
  const pages: PageImage[] = [];
  const runs: TextRun[] = [];
  let y = MARGIN;
  let dirty = false;
  const reset = () => {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#172033';
    y = MARGIN;
    dirty = false;
  };
  const finishPage = async () => {
    checkConversionAbort(options);
    if (!dirty && pages.length) return;
    if (pages.length >= MAX_PAGES) throw new Error('Nội dung vượt giới hạn 200 trang. Hãy chia nhỏ tệp trước khi xuất.');
    options.onProgress?.(`Đang dựng trang ${pages.length + 1}…`);
    pages.push({ blob: await canvasBlob(canvas, mime), mime, pixelWidth: canvas.width, pixelHeight: canvas.height, cssWidth: WIDTH, cssHeight: HEIGHT });
    reset();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };
  const ensure = async (height: number) => { if (y + height > BOTTOM && dirty) await finishPage(); };
  const font = (size: number, bold = false) => { ctx.font = `${bold ? '700' : '400'} ${size}px Arial, sans-serif`; };
  const textLine = (text: string, x: number, top: number, size: number) => {
    ctx.fillStyle = '#172033';
    ctx.fillText(text, x, top);
    if (text && target === 'pdf') runs.push({ page: pages.length, x, y: top, w: ctx.measureText(text).width, h: size * 1.25, text });
    dirty = true;
  };
  const paragraph = async (text: string, size = 16, bold = false, indent = 0) => {
    font(size, bold);
    const lineHeight = size * 1.45;
    const lines = wrapConversionText(text, CONTENT_WIDTH - indent, (value) => ctx.measureText(value).width);
    for (const line of lines) {
      checkConversionAbort(options);
      await ensure(lineHeight);
      font(size, bold);
      textLine(line, MARGIN + indent, y, size);
      y += lineHeight;
    }
    y += size * 0.5;
  };
  const picture = async (node: JSONContent) => {
    const src = String(node.attrs?.src ?? '');
    if (!src.startsWith('data:image/')) throw new Error('Ảnh chưa được nhúng trong tài liệu.');
    const image = await loadImage(src, options);
    try {
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error('Ảnh nhúng vượt giới hạn 60 triệu điểm ảnh hoặc không có kích thước hợp lệ.');
      const ratio = Math.min(CONTENT_WIDTH / image.naturalWidth, (BOTTOM - MARGIN - 16) / image.naturalHeight, 1);
      const width = image.naturalWidth * ratio;
      const height = image.naturalHeight * ratio;
      await ensure(height + 16);
      ctx.drawImage(image, MARGIN, y, width, height);
      y += height + 16;
      dirty = true;
    } finally { image.src = ''; }
  };
  const table = async (node: JSONContent) => {
    const rows = conversionTableGrid(node).rows;
    const columnCount = Math.max(1, ...rows.map((row) => row.length));
    const groupSize = 8;
    for (let startColumn = 0; startColumn < columnCount; startColumn += groupSize) {
      const count = Math.min(groupSize, columnCount - startColumn);
      const cellWidth = CONTENT_WIDTH / count;
      if (columnCount > groupSize) await paragraph(`Cột ${startColumn + 1}–${startColumn + count}`, 14, true);
      for (const row of rows) {
        checkConversionAbort(options);
        font(12);
        const values = row;
        const lines = Array.from({ length: count }, (_, index) => wrapConversionText(values[startColumn + index] ?? '', cellWidth - 12, (value) => ctx.measureText(value).width));
        const lineCount = Math.max(1, ...lines.map((cell) => cell.length));
        let offset = 0;
        while (offset < lineCount) {
          await ensure(30);
          font(12);
          const capacity = Math.max(1, Math.floor((BOTTOM - y - 12) / 18));
          const take = Math.min(capacity, lineCount - offset);
          const height = take * 18 + 12;
          for (let column = 0; column < count; column += 1) {
            const x = MARGIN + column * cellWidth;
            ctx.strokeStyle = '#ccd2dc';
            ctx.lineWidth = 0.75;
            ctx.strokeRect(x, y, cellWidth, height);
            for (let line = 0; line < take; line += 1) textLine(lines[column][offset + line] ?? '', x + 6, y + 6 + line * 18, 12);
          }
          y += height;
          offset += take;
          if (offset < lineCount) await finishPage();
        }
      }
      y += 16;
    }
  };
  const embeddedImages = (node: JSONContent): JSONContent[] => node.type === 'image' ? [node] : (node.content ?? []).flatMap(embeddedImages);
  const render = async (node: JSONContent, indent = 0): Promise<void> => {
    checkConversionAbort(options);
    if (node.type === 'pageBreak') { if (dirty) await finishPage(); return; }
    if (node.type === 'image') return picture(node);
    if (node.type === 'table') return table(node);
    if (node.type === 'heading' || node.type === 'paragraph' || node.type === 'codeBlock') {
      const size = node.type === 'heading' ? Math.max(18, 30 - (Number(node.attrs?.level) || 1) * 3) : 16;
      await paragraph(conversionNodeText(node), size, node.type === 'heading', indent);
      for (const image of embeddedImages(node)) await picture(image);
      return;
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const [index, item] of (node.content ?? []).entries()) {
        const [first, ...rest] = item.content ?? [];
        if (first) await paragraph(`${node.type === 'orderedList' ? `${index + 1}.` : '•'} ${conversionNodeText(first)}`, 16, false, indent + 16);
        for (const image of first ? embeddedImages(first) : []) await picture(image);
        for (const child of rest) await render(child, indent + 16);
      }
      return;
    }
    if (node.type === 'horizontalRule') {
      await ensure(16);
      ctx.strokeStyle = '#ccd2dc';
      ctx.beginPath(); ctx.moveTo(MARGIN, y + 8); ctx.lineTo(WIDTH - MARGIN, y + 8); ctx.stroke();
      y += 24; dirty = true; return;
    }
    for (const child of node.content ?? []) await render(child, indent);
  };
  try {
    reset();
    await render(json);
    if (dirty || !pages.length) await finishPage();
    checkConversionAbort(options);
    if (target === 'pdf') {
      const { buildPdf } = await import('./docPageFormats');
      const blob = await buildPdf({ pages, runs, links: [], title: base, page: { size: 'A4', orientation: 'portrait', margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }, header: '', footer: '', pageNumbers: false } });
      checkConversionAbort(options);
      return [{ name: `${base}.pdf`, blob }];
    }
    return pages.map((image, index) => ({ name: `${base}${pages.length > 1 ? ` - trang ${String(index + 1).padStart(3, '0')}` : ''}.${target}`, blob: image.blob }));
  } finally { canvas.width = 0; canvas.height = 0; }
}
