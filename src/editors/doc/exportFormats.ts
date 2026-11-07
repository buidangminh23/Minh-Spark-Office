import { exportDocx, jsonToMarkdown } from '../../lib/docxConvert';
import { exportEpub, exportOdt, exportRtf } from '../../lib/docExports';
import { exportLatex, exportPptx, jsonToText, resolveImages, tablesOf, tablesToXlsx, tableToCsv } from '../../lib/docOtherFormats';
import { buildPdf, buildXps, pagesAsFiles, zipFiles } from '../../lib/docPageFormats';
import { docxToFlatOpc, docxToTemplate } from '../../lib/docWordFormats';
import { downloadBlob } from '../../lib/download';
import type { DocCtx } from './DocContext';
import { slidesHtml } from './actions';
import { flattenForExport } from './docFlatten';
import { buildWebMht, buildWebZip, buildWordDoc, standaloneHtmlFrom } from './docHtml';
import { collectLinks, collectTextRuns, renderPages, withPageLayout, type PageImage } from './pageRender';

export type ExportFile = { name: string; blob: Blob };
export type ExportResult = ExportFile[];

const PDF_SCALE = 2.5;
const IMAGE_SCALE = 2;
const JPEG_QUALITY = 0.92;
const WEBP_QUALITY = 0.92;

const baseName = (ctx: DocCtx) => ctx.title.replace(/\.[^/.]+$/, '') || 'Tai-lieu';
const textBlob = (text: string, type: string) => new Blob([text], { type: `${type};charset=utf-8` });
const one = (ctx: DocCtx, extension: string, blob: Blob): ExportResult => [{ name: `${baseName(ctx)}.${extension}`, blob }];

const flat = (ctx: DocCtx, equationAsText = true) => flattenForExport(ctx.editor, { equationAsText });
const flatResolved = (ctx: DocCtx, equationAsText = true) => resolveImages(flat(ctx, equationAsText));
const docxBlob = async (ctx: DocCtx) => exportDocx(await flatResolved(ctx, false), ctx.page, ctx.title);

const requirePaged = (ctx: DocCtx) => {
  if ((ctx.page.columns ?? 1) > 1) throw new Error('Tài liệu đang chia cột toàn trang: hãy dùng "PDF qua hộp thoại in", hoặc đặt lại 1 cột rồi xuất.');
};

const showProgress = (ctx: DocCtx, label: string) => (done: number, total: number) => ctx.ui.showBusy(`${label} (${done}/${total})`);

const rasterize = (ctx: DocCtx, scale: number, mime: string, quality?: number) => withPageLayout(ctx, (layout) => renderPages(layout, { scale, mime, quality, onProgress: showProgress(ctx, 'Đang dựng trang') }));

const buildPdfBlob = async (ctx: DocCtx) => {
  requirePaged(ctx);
  return withPageLayout(ctx, async (layout) => {
    const runs = collectTextRuns(layout);
    const links = collectLinks(layout);
    const pages = await renderPages(layout, { scale: PDF_SCALE, mime: 'image/jpeg', quality: JPEG_QUALITY, onProgress: showProgress(ctx, 'Đang dựng trang PDF') });
    return buildPdf({ pages, runs, links, title: baseName(ctx), page: ctx.page });
  });
};

const imagesResult = async (ctx: DocCtx, mime: string, extension: string, quality?: number): Promise<ExportResult> => {
  requirePaged(ctx);
  const pages: PageImage[] = await rasterize(ctx, IMAGE_SCALE, mime, quality);
  if (pages[0] && pages[0].mime !== mime) throw new Error(`Trình duyệt này không tạo được ảnh .${extension}.`);
  const files = pagesAsFiles(pages, baseName(ctx), extension);
  return files.length === 1 ? files : [{ name: `${baseName(ctx)} - anh ${extension}.zip`, blob: await zipFiles(files) }];
};

const tablesRequired = (ctx: DocCtx) => {
  const tables = tablesOf(flat(ctx));
  if (!tables.length) throw new Error('Tài liệu chưa có bảng nào để xuất.');
  return tables;
};

export type ExportFormat = {
  id: string;
  title: string;
  desc: string;
  color: string;
  icon: 'word' | 'pdf' | 'web' | 'text' | 'book' | 'slides' | 'table' | 'image' | 'print';
  build?: (ctx: DocCtx) => Promise<ExportResult>;
  inBundle?: boolean;
};

export type ExportGroup = { label: string; formats: ExportFormat[] };

export const EXPORT_GROUPS: ExportGroup[] = [
  {
    label: 'Word và văn phòng',
    formats: [
      { id: 'docx', title: 'Word (.docx)', desc: 'Microsoft Word, Google Docs, WPS. Giữ đủ định dạng, chú thích, công thức', color: '#2b579a', icon: 'word', inBundle: true, build: async (ctx) => one(ctx, 'docx', await docxBlob(ctx)) },
      { id: 'dotx', title: 'Mẫu Word (.dotx)', desc: 'Mở ra là tạo văn bản mới theo mẫu này', color: '#2b579a', icon: 'word', inBundle: true, build: async (ctx) => one(ctx, 'dotx', await docxToTemplate(await docxBlob(ctx))) },
      { id: 'doc', title: 'Word 97-2003 (.doc)', desc: 'Cho máy dùng Word đời cũ. Đầu trang, chân trang không đi theo', color: '#2b579a', icon: 'word', inBundle: true, build: async (ctx) => one(ctx, 'doc', buildWordDoc(ctx.editor, await flatResolved(ctx), baseName(ctx), ctx.page)) },
      { id: 'xml', title: 'Word XML (.xml)', desc: 'Một tệp XML duy nhất, tiện lưu trong kho mã', color: '#2b579a', icon: 'word', inBundle: true, build: async (ctx) => one(ctx, 'xml', await docxToFlatOpc(await docxBlob(ctx))) },
      { id: 'odt', title: 'OpenDocument (.odt)', desc: 'LibreOffice, OpenOffice, Google Docs', color: '#0891b2', icon: 'word', inBundle: true, build: async (ctx) => one(ctx, 'odt', await exportOdt(await flatResolved(ctx), ctx.page, ctx.title)) },
      { id: 'rtf', title: 'Rich Text (.rtf)', desc: 'Trình soạn thảo cũ, WordPad', color: '#586071', icon: 'word', inBundle: true, build: async (ctx) => one(ctx, 'rtf', exportRtf(await flatResolved(ctx), ctx.page)) },
    ],
  },
  {
    label: 'PDF và bản in',
    formats: [
      { id: 'pdf', title: 'PDF tải ngay (.pdf)', desc: 'Tải thẳng về máy, đúng từng trang, chọn và tìm được chữ', color: '#d7473c', icon: 'pdf', inBundle: true, build: async (ctx) => one(ctx, 'pdf', await buildPdfBlob(ctx)) },
      { id: 'pdf-print', title: 'PDF qua hộp thoại in', desc: 'Chữ dạng vector sắc nét khi phóng to. Chọn "Lưu dưới dạng PDF"', color: '#d7473c', icon: 'print' },
      { id: 'xps', title: 'XPS (.xps)', desc: 'Bản in cố định của Windows', color: '#586071', icon: 'pdf', inBundle: true, build: async (ctx) => { requirePaged(ctx); return one(ctx, 'xps', await buildXps(await rasterize(ctx, PDF_SCALE, 'image/jpeg', JPEG_QUALITY))); } },
    ],
  },
  {
    label: 'Trang web',
    formats: [
      { id: 'html', title: 'Trang web (.html)', desc: 'Một tệp độc lập, ảnh nằm ngay trong tệp', color: '#d98e04', icon: 'web', inBundle: true, build: async (ctx) => one(ctx, 'html', textBlob(standaloneHtmlFrom(ctx.editor, flat(ctx, false), baseName(ctx), ctx.page), 'text/html')) },
      { id: 'mht', title: 'Trang web một tệp (.mht)', desc: 'Định dạng lưu trang của Word và trình duyệt', color: '#d98e04', icon: 'web', inBundle: true, build: async (ctx) => one(ctx, 'mht', buildWebMht(ctx.editor, await flatResolved(ctx, false), baseName(ctx), ctx.page)) },
      { id: 'web-zip', title: 'Trang web kèm ảnh (.zip)', desc: 'index.html và thư mục ảnh, để đăng lên máy chủ', color: '#d98e04', icon: 'web', inBundle: true, build: async (ctx) => [{ name: `${baseName(ctx)} - web.zip`, blob: await buildWebZip(ctx.editor, flat(ctx, false), baseName(ctx), ctx.page) }] },
    ],
  },
  {
    label: 'Văn bản và mã nguồn',
    formats: [
      { id: 'md', title: 'Markdown (.md)', desc: 'GitHub, Obsidian, Notion', color: '#586071', icon: 'text', inBundle: true, build: async (ctx) => one(ctx, 'md', textBlob(jsonToMarkdown(flat(ctx)), 'text/markdown')) },
      { id: 'txt', title: 'Văn bản thuần (.txt)', desc: 'Chỉ chữ, chú thích ở cuối tệp', color: '#586071', icon: 'text', inBundle: true, build: async (ctx) => one(ctx, 'txt', textBlob(jsonToText(flat(ctx)), 'text/plain')) },
      { id: 'tex', title: 'LaTeX (.tex)', desc: 'Giữ công thức gốc. Có ảnh thì gói kèm thành .zip', color: '#0f766e', icon: 'text', inBundle: true, build: async (ctx) => {
        const { blob, extension } = await exportLatex(await flatResolved(ctx, false), ctx.page, baseName(ctx));
        return [{ name: extension === 'zip' ? `${baseName(ctx)} - latex.zip` : `${baseName(ctx)}.tex`, blob }];
      } },
    ],
  },
  {
    label: 'Sách và trình chiếu',
    formats: [
      { id: 'epub', title: 'Sách điện tử (.epub)', desc: 'Điện thoại, máy đọc sách. Mỗi tiêu đề cấp 1 là một chương', color: '#7c3aed', icon: 'book', inBundle: true, build: async (ctx) => one(ctx, 'epub', await exportEpub(await flatResolved(ctx), ctx.page, baseName(ctx))) },
      { id: 'pptx', title: 'PowerPoint (.pptx)', desc: 'Mỗi tiêu đề thành một slide, sửa tiếp được trong PowerPoint', color: '#c43e1c', icon: 'slides', inBundle: true, build: async (ctx) => one(ctx, 'pptx', await exportPptx(await flatResolved(ctx), ctx.page, baseName(ctx))) },
      { id: 'slides-html', title: 'Trình chiếu web (.html)', desc: 'Mở bằng trình duyệt, bấm mũi tên để chuyển slide', color: '#ea580c', icon: 'slides', build: async (ctx) => [{ name: `${baseName(ctx)} - trinh chieu.html`, blob: textBlob(slidesHtml(ctx), 'text/html') }] },
    ],
  },
  {
    label: 'Bảng dữ liệu',
    formats: [
      { id: 'xlsx', title: 'Excel (.xlsx)', desc: 'Mỗi bảng trong tài liệu thành một trang tính', color: '#107c41', icon: 'table', build: async (ctx) => one(ctx, 'xlsx', await tablesToXlsx(tablesRequired(ctx))) },
      { id: 'csv', title: 'CSV (.csv)', desc: 'Dữ liệu các bảng. Nhiều bảng thì gói thành .zip', color: '#107c41', icon: 'table', build: async (ctx) => {
        const tables = tablesRequired(ctx);
        if (tables.length === 1) return one(ctx, 'csv', tableToCsv(tables[0]));
        return [{ name: `${baseName(ctx)} - bang csv.zip`, blob: await zipFiles(tables.map((rows, i) => ({ name: `${baseName(ctx)} - bang ${i + 1}.csv`, blob: tableToCsv(rows) }))) }];
      } },
    ],
  },
  {
    label: 'Ảnh từng trang',
    formats: [
      { id: 'png', title: 'Ảnh PNG (.png)', desc: 'Nét nhất. Nhiều trang thì gói thành .zip', color: '#107c41', icon: 'image', inBundle: true, build: (ctx) => imagesResult(ctx, 'image/png', 'png') },
      { id: 'jpg', title: 'Ảnh JPEG (.jpg)', desc: 'Dung lượng nhỏ, tiện gửi Zalo', color: '#107c41', icon: 'image', build: (ctx) => imagesResult(ctx, 'image/jpeg', 'jpg', JPEG_QUALITY) },
      { id: 'webp', title: 'Ảnh WebP (.webp)', desc: 'Nhỏ hơn JPEG, dùng cho web', color: '#107c41', icon: 'image', build: (ctx) => imagesResult(ctx, 'image/webp', 'webp', WEBP_QUALITY) },
    ],
  },
];

const findFormat = (id: string) => EXPORT_GROUPS.flatMap((group) => group.formats).find((format) => format.id === id);

export async function exportFormat(ctx: DocCtx, id: string) {
  const format = findFormat(id);
  if (!format) return;
  if (!format.build) {
    ctx.print();
    return;
  }
  try {
    ctx.ui.showBusy(`Đang tạo ${format.title}…`);
    const files = await format.build(ctx);
    files.forEach((file) => downloadBlob(file.blob, file.name));
    ctx.ui.toast(`Đã tải xuống ${format.title}`);
  } catch (error) {
    ctx.ui.toast((error as Error).message || `Không xuất được ${format.title}`, true);
  } finally {
    ctx.ui.showBusy(null);
  }
}

export async function exportAllFormats(ctx: DocCtx) {
  const formats = EXPORT_GROUPS.flatMap((group) => group.formats).filter((format) => format.inBundle && format.build);
  const files: ExportFile[] = [];
  const failed: string[] = [];
  try {
    for (const [index, format] of formats.entries()) {
      ctx.ui.showBusy(`Đang tạo ${format.title} (${index + 1}/${formats.length})`);
      try {
        files.push(...await (format.build as NonNullable<ExportFormat['build']>)(ctx));
      } catch {
        failed.push(format.title);
      }
    }
    if (!files.length) throw new Error('Không tạo được định dạng nào.');
    downloadBlob(await zipFiles(files), `${baseName(ctx)} - tat ca dinh dang.zip`);
    ctx.ui.toast(failed.length ? `Đã tải ${files.length} tệp. Không tạo được: ${failed.join(', ')}` : `Đã tải gói ${files.length} tệp`, failed.length > 0);
  } catch (error) {
    ctx.ui.toast((error as Error).message, true);
  } finally {
    ctx.ui.showBusy(null);
  }
}
