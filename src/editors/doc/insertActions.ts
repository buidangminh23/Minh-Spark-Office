import type { JSONContent } from '@tiptap/react';
import { importDocx } from '../../lib/docxConvert';
import { importDocxFull } from '../../lib/docxImport';
import { pickFile } from '../../lib/download';
import { newId, type DocCtx } from './DocContext';

export type TableOptions = { header?: boolean; style?: string; widths?: number[] };

export const tableJson = (rows: string[][], { header = true, style = 'grid', widths }: TableOptions = {}): JSONContent => ({
  type: 'table',
  attrs: { tableStyle: style },
  content: rows.map((row, rowIndex) => ({
    type: 'tableRow',
    content: row.map((text, col) => ({
      type: header && rowIndex === 0 ? 'tableHeader' : 'tableCell',
      ...(widths ? { attrs: { colwidth: [widths[col]] } } : {}),
      content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
    })),
  })),
});

export const insertTableJson = (ctx: DocCtx, table: JSONContent) => ctx.editor.chain().focus().insertContent([table, { type: 'paragraph' }]).run();

const MAX_IMPORT_ROWS = 300;
const MAX_IMPORT_COLS = 40;

export async function insertSpreadsheet(ctx: DocCtx) {
  const file = await pickFile('.xlsx,.xls,.csv,.tsv,.ods');
  if (!file) return;
  try {
    ctx.ui.showBusy(`Đang đọc ${file.name}…`);
    const XLSX = await import('xlsx');
    const lower = file.name.toLowerCase();
    const book = lower.endsWith('.csv') || lower.endsWith('.tsv')
      ? XLSX.read(await file.text(), { type: 'string' })
      : XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, blankrows: false, defval: '' });
    const rows = raw.slice(0, MAX_IMPORT_ROWS).map((row) => row.slice(0, MAX_IMPORT_COLS).map((cell) => String(cell ?? '')));
    if (!rows.length) {
      ctx.ui.toast('Trang tính đầu tiên không có dữ liệu', true);
      return;
    }
    const cols = Math.max(...rows.map((row) => row.length));
    insertTableJson(ctx, tableJson(rows.map((row) => Array.from({ length: cols }, (_, col) => row[col] ?? ''))));
    const clipped = raw.length > MAX_IMPORT_ROWS ? ` (lấy ${MAX_IMPORT_ROWS}/${raw.length} hàng)` : '';
    ctx.ui.toast(`Đã chèn trang tính “${book.SheetNames[0]}”${clipped}`);
  } catch (error) {
    ctx.ui.toast((error as Error).message || 'Không đọc được tệp bảng tính', true);
  } finally {
    ctx.ui.showBusy(null);
  }
}

const quickCalendar = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const rows = [['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']];
  let week: string[] = Array.from({ length: offset }, () => '');
  for (let day = 1; day <= days; day++) {
    week.push(String(day));
    if (week.length === 7) {
      rows.push(week);
      week = [];
    }
  }
  if (week.length) rows.push([...week, ...Array.from({ length: 7 - week.length }, () => '')]);
  return rows;
};

export const QUICK_TABLES: { id: string; label: string; detail: string; style: string; rows: () => string[][] }[] = [
  { id: 'calendar', label: 'Lịch tháng này', detail: 'Bảy cột từ thứ Hai đến Chủ nhật', style: 'blue', rows: quickCalendar },
  { id: 'list2', label: 'Danh sách hai cột', detail: 'Mục và mô tả', style: 'lines', rows: () => [['Mục', 'Mô tả'], ['Mục 1', ''], ['Mục 2', ''], ['Mục 3', '']] },
  { id: 'matrix', label: 'Ma trận', detail: 'So sánh theo hàng và cột', style: 'grid', rows: () => [['', 'Tiêu chí 1', 'Tiêu chí 2', 'Tiêu chí 3'], ['Phương án A', '', '', ''], ['Phương án B', '', '', ''], ['Phương án C', '', '', '']] },
  { id: 'quote', label: 'Bảng báo giá', detail: 'STT, hàng hoá, số lượng, đơn giá, thành tiền', style: 'report', rows: () => [['STT', 'Hàng hoá, dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền'], ['1', '', '', '', '', ''], ['2', '', '', '', '', ''], ['3', '', '', '', '', ''], ['', 'Tổng cộng', '', '', '', '']] },
  { id: 'schedule', label: 'Lịch công tác tuần', detail: 'Thứ, buổi sáng, buổi chiều', style: 'green', rows: () => [['Thứ', 'Sáng', 'Chiều', 'Ghi chú'], ...['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'].map((day) => [day, '', '', ''])] },
  { id: 'tasks', label: 'Theo dõi công việc', detail: 'Việc, người làm, hạn, trạng thái', style: 'striped', rows: () => [['Công việc', 'Người phụ trách', 'Hạn', 'Trạng thái'], ['', '', '', 'Chưa bắt đầu'], ['', '', '', 'Đang làm'], ['', '', '', 'Hoàn thành']] },
  { id: 'signoff', label: 'Khối ký hai bên', detail: 'Hai cột không viền', style: 'plain', rows: () => [['ĐẠI DIỆN BÊN A', 'ĐẠI DIỆN BÊN B'], ['', ''], ['', ''], ['', '']] },
];

export async function captureScreenshot(ctx: DocCtx, clip: boolean) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    ctx.ui.toast('Trình duyệt này không hỗ trợ chụp màn hình', true);
    return;
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (error) {
    if ((error as Error).name !== 'NotAllowedError') ctx.ui.toast('Không chụp được màn hình', true);
    return;
  }
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const { editor } = ctx;
    const from = editor.state.selection.from;
    editor.chain().focus().setImage({ src: canvas.toDataURL('image/png'), alt: 'Ảnh chụp màn hình' }).run();
    if (clip) {
      editor.commands.setNodeSelection(from);
      ctx.openDialog('imageedit');
    }
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export async function insertTextFromFile(ctx: DocCtx) {
  const file = await pickFile('.docx,.html,.htm,.txt,.md');
  if (!file) return;
  try {
    ctx.ui.showBusy(`Đang đọc ${file.name}…`);
    const lower = file.name.toLowerCase();
    let content: string;
    if (lower.endsWith('.docx')) content = (await importDocxFull(await file.arrayBuffer()).catch(async () => ({ html: await importDocx(await file.arrayBuffer()) }))).html;
    else if (lower.endsWith('.html') || lower.endsWith('.htm')) content = (await file.text()).replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, '');
    else content = (await file.text()).split(/\n{2,}/).map((part) => `<p>${part.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c).replace(/\n/g, '<br>')}</p>`).join('');
    ctx.editor.chain().focus().insertContent(content).run();
    ctx.ui.toast(`Đã chèn nội dung “${file.name}” tại con trỏ`);
  } catch (error) {
    ctx.ui.toast((error as Error).message || 'Không đọc được tệp', true);
  } finally {
    ctx.ui.showBusy(null);
  }
}

export const insertMetaImage = (ctx: DocCtx, image: { src: string; alt: string; meta?: unknown; width?: string }) => {
  const { editor, editing } = ctx;
  const meta = image.meta === undefined ? undefined : JSON.stringify(image.meta);
  const node = editing ? editor.state.doc.nodeAt(editing.pos) : null;
  if (editing && node?.type.name === 'image') {
    editor.view.dispatch(editor.state.tr.setNodeMarkup(editing.pos, undefined, { ...node.attrs, src: image.src, alt: image.alt, meta: meta ?? null }));
    return;
  }
  editor.chain().focus().setImage({ src: image.src, alt: image.alt, ...(meta ? { meta } : {}), ...(image.width ? { width: image.width } : {}) } as never).run();
};

const BLOCKS_KEY = 'minh-docs-building-blocks';

export type BuildingBlock = { id: string; name: string; gallery: string; description?: string; json: JSONContent[]; createdAt: number };

export const loadBlocks = (): BuildingBlock[] => {
  try {
    return JSON.parse(localStorage.getItem(BLOCKS_KEY) ?? '[]') as BuildingBlock[];
  } catch {
    return [];
  }
};

export const saveBlocks = (blocks: BuildingBlock[]) => {
  try {
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
    return true;
  } catch {
    return false;
  }
};

export const BLOCK_GALLERIES = ['Văn bản tự động', 'Khối dựng sẵn', 'Điều khoản', 'Ký tên'];

export async function saveSelectionAsBlock(ctx: DocCtx) {
  const { editor } = ctx;
  if (editor.state.selection.empty) {
    ctx.ui.toast('Hãy bôi chọn nội dung cần lưu trước', true);
    return;
  }
  const preview = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ').trim();
  const res = await ctx.ui.ask({
    title: 'Tạo khối dựng sẵn mới',
    fields: [
      { name: 'name', label: 'Tên', value: preview.slice(0, 40) },
      { name: 'gallery', label: 'Bộ sưu tập', type: 'select', value: BLOCK_GALLERIES[0], options: BLOCK_GALLERIES.map((value) => ({ value, label: value })) },
      { name: 'description', label: 'Mô tả' },
    ],
    confirmText: 'Lưu',
  });
  const name = String(res?.name ?? '').trim();
  if (!res || !name) return;
  const json = editor.state.selection.content().content.toJSON() as JSONContent[];
  const stored = saveBlocks([{ id: newId('block'), name, gallery: String(res.gallery), description: String(res.description ?? ''), json, createdAt: Date.now() }, ...loadBlocks()]);
  ctx.ui.toast(stored ? `Đã lưu “${name}” vào ${String(res.gallery)}` : 'Khối quá lớn, trình duyệt không lưu được', !stored);
}

export const insertBlock = (ctx: DocCtx, block: BuildingBlock) => {
  const single = block.json.length === 1 && block.json[0].type === 'paragraph';
  ctx.editor.chain().focus().insertContent(single ? block.json[0].content ?? [] : block.json).run();
};

const SYMBOL_KEY = 'minh-docs-recent-symbols';
const DEFAULT_SYMBOLS = ['©', '®', '™', '§', '¶', '°', '±', '×', '÷', '≠', '≤', '≥', '∞', '√', '→', '←', '₫', '€', '★', '✓'];
const RECENT_SYMBOL_COUNT = 20;

export const loadRecentSymbols = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SYMBOL_KEY) ?? '[]') as string[];
    return [...new Set([...saved, ...DEFAULT_SYMBOLS])].slice(0, RECENT_SYMBOL_COUNT);
  } catch {
    return DEFAULT_SYMBOLS;
  }
};

export const pushRecentSymbol = (symbol: string) => {
  try {
    const saved = JSON.parse(localStorage.getItem(SYMBOL_KEY) ?? '[]') as string[];
    localStorage.setItem(SYMBOL_KEY, JSON.stringify([symbol, ...saved.filter((item) => item !== symbol)].slice(0, RECENT_SYMBOL_COUNT)));
  } catch {
    return;
  }
};
