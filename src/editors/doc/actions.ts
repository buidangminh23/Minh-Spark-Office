import type { JSONContent } from '@tiptap/react';
import { exportDocx, importDocx } from '../../lib/docxConvert';
import { resolveImages } from '../../lib/docOtherFormats';
import { importDocxFull } from '../../lib/docxImport';
import { flattenForExport } from './docFlatten';
import { downloadBlob, pickFile, readAsDataUrl } from '../../lib/download';
import { type FileMeta, type PageSettings } from '../../lib/storage';
import { AUTHOR, newId, type DocCtx } from './DocContext';
import { jsonText, sha256, splitByHeading, transformCase, type CaseMode } from './docTools';

const baseName = (ctx: DocCtx) => ctx.title.replace(/\.[^/.]+$/, '') || 'Tai-lieu';

const run = async (ctx: DocCtx, busy: string, task: () => Promise<void>, failure: string) => {
  try {
    ctx.ui.showBusy(busy);
    await task();
  } catch (error) {
    ctx.ui.toast((error as Error).message || failure, true);
  } finally {
    ctx.ui.showBusy(null);
  }
};

export const exportAsDocx = (ctx: DocCtx) => run(ctx, 'Đang tạo tệp .docx…', async () => {
  downloadBlob(await exportDocx(await resolveImages(flattenForExport(ctx.editor)), ctx.page, ctx.title), `${baseName(ctx)}.docx`);
  ctx.ui.toast('Đã tải xuống tệp Word (.docx)');
}, 'Lỗi khi xuất DOCX');

export const slidesHtml = (ctx: DocCtx) => {
  const json = flattenForExport(ctx.editor, { equationAsText: true });
  const slides: { title: string; body: string[] }[] = [];
  for (const block of json.content ?? []) {
    const text = jsonText(block).trim();
    if (!text) continue;
    if (block.type === 'heading' && Number(block.attrs?.level) <= 2) slides.push({ title: text, body: [] });
    else if (slides.length) slides[slides.length - 1].body.push(...text.split('\n').filter(Boolean));
    else slides.push({ title: ctx.title, body: [text] });
  }
  if (!slides.length) throw new Error('Tài liệu chưa có nội dung để tạo slide');
  const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  const sections = slides.map((s, i) => `<section class="${i ? '' : 'active'}"><h1>${escape(s.title)}</h1><ul>${s.body.slice(0, 8).map((b) => `<li>${escape(b)}</li>`).join('')}</ul><footer>${i + 1} / ${slides.length}</footer></section>`).join('');
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${escape(ctx.title)}</title><style>body{margin:0;background:#0f172a;font-family:Segoe UI,Arial,sans-serif}section{display:none;box-sizing:border-box;width:100vw;height:100vh;padding:8vh 10vw;background:linear-gradient(135deg,#ffffff,#eef2fb);color:#1e2430}section.active{display:block}h1{font-size:5vh;color:#2b579a;margin:0 0 4vh}li{font-size:3vh;line-height:1.5;margin-bottom:1.5vh}footer{position:absolute;bottom:4vh;right:6vw;color:#798394;font-size:2vh}</style></head><body>${sections}<script>let i=0;const s=document.querySelectorAll('section');const go=d=>{s[i].classList.remove('active');i=Math.max(0,Math.min(s.length-1,i+d));s[i].classList.add('active')};addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key))go(1);if(['ArrowLeft','PageUp'].includes(e.key))go(-1)});addEventListener('click',()=>go(1));</script></body></html>`;
};

export const insertImageFromDevice = async (ctx: DocCtx) => {
  const file = await pickFile('image/*');
  if (!file) return;
  try {
    ctx.editor.chain().focus().setImage({ src: await readAsDataUrl(file), alt: file.name }).run();
  } catch {
    ctx.ui.toast('Không đọc được ảnh này', true);
  }
};

export const insertImageFromUrl = async (ctx: DocCtx) => {
  const res = await ctx.ui.ask({ title: 'Chèn ảnh từ địa chỉ web', fields: [{ name: 'url', label: 'URL ảnh', placeholder: 'https://…/anh.png' }, { name: 'alt', label: 'Mô tả ảnh (alt text)' }], confirmText: 'Chèn ảnh' });
  const url = String(res?.url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return;
  ctx.editor.chain().focus().setImage({ src: url, alt: String(res?.alt ?? '') }).run();
};

export const editLink = async (ctx: DocCtx) => {
  const { editor } = ctx;
  const { from, to } = editor.state.selection;
  const current = editor.getAttributes('link').href ?? '';
  const selected = editor.state.doc.textBetween(from, to, ' ');
  const res = await ctx.ui.ask({
    title: current ? 'Sửa liên kết' : 'Chèn liên kết',
    fields: [
      { name: 'text', label: 'Văn bản hiển thị', value: selected, placeholder: 'Để trống để dùng chính địa chỉ' },
      { name: 'url', label: 'Địa chỉ (URL, email hoặc #tieu-de)', value: current, placeholder: 'https://example.com' },
    ],
    confirmText: 'Áp dụng',
  });
  if (!res) return;
  let url = String(res.url ?? '').trim();
  if (!url) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) url = `mailto:${url}`;
  else if (!/^(https?:|mailto:|tel:|#)/i.test(url)) url = `https://${url}`;
  const text = String(res.text ?? '').trim();
  if (text && text !== selected) editor.chain().focus().insertContentAt({ from, to }, { type: 'text', text, marks: [{ type: 'link', attrs: { href: url } }] }).run();
  else if (from === to) editor.chain().focus().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
  else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
};

export const insertDateTime = (ctx: DocCtx, kind: 'date' | 'long' | 'time' | 'datetime') => {
  const now = new Date();
  const map = {
    date: now.toLocaleDateString('vi-VN'),
    long: `ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`,
    time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    datetime: `${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${now.toLocaleDateString('vi-VN')}`,
  };
  ctx.editor.chain().focus().insertContent(map[kind]).run();
};

export const addComment = async (ctx: DocCtx) => {
  const { editor } = ctx;
  const { from, to, empty } = editor.state.selection;
  const res = await ctx.ui.ask({ title: 'Bình luận mới', message: empty ? 'Chưa chọn đoạn văn nào — bình luận sẽ gắn vào toàn tài liệu.' : `Gắn vào: “${editor.state.doc.textBetween(from, to, ' ').slice(0, 120)}”`, fields: [{ name: 'text', label: 'Nội dung bình luận', type: 'textarea' }], confirmText: 'Đăng' });
  const text = String(res?.text ?? '').trim();
  if (!text) return;
  const id = newId('c');
  if (!empty) editor.chain().focus().setTextSelection({ from, to }).setComment(id).run();
  ctx.setComments((items) => [{ id, author: AUTHOR, text, createdAt: Date.now(), resolved: false, quote: empty ? undefined : editor.state.doc.textBetween(from, to, ' ').slice(0, 200), replies: [] }, ...items]);
  ctx.setView({ sidePanel: 'comments' });
  ctx.setActiveCommentId(id);
  ctx.markDirty();
};

export const insertFootnote = async (ctx: DocCtx) => {
  const res = await ctx.ui.ask({ title: 'Chèn chú thích cuối trang', fields: [{ name: 'text', label: 'Nội dung chú thích', type: 'textarea' }], confirmText: 'Chèn' });
  const text = String(res?.text ?? '').trim();
  if (text) ctx.editor.chain().focus().insertFootnote(text).run();
};

export const insertCaption = async (ctx: DocCtx) => {
  const res = await ctx.ui.ask({ title: 'Chèn chú thích hình/bảng', fields: [{ name: 'kind', label: 'Nhãn', type: 'select', value: 'Hình', options: ['Hình', 'Bảng', 'Biểu đồ', 'Công thức'].map((v) => ({ value: v, label: v })) }, { name: 'text', label: 'Nội dung', placeholder: 'Sơ đồ tổ chức công ty' }], confirmText: 'Chèn' });
  if (!res) return;
  const kind = String(res.kind);
  let count = 1;
  ctx.editor.state.doc.descendants((node) => {
    if (node.attrs?.captionKind === kind) count++;
    return true;
  });
  ctx.editor.chain().focus().insertContent({ type: 'paragraph', attrs: { textAlign: 'center', captionKind: kind }, content: [{ type: 'text', text: `${kind} ${count}: `, marks: [{ type: 'bold' }, { type: 'italic' }] }, ...(String(res.text).trim() ? [{ type: 'text', text: String(res.text).trim(), marks: [{ type: 'italic' }] }] : [])] }).run();
};

export const changeCase = (ctx: DocCtx, mode: CaseMode) => {
  const { editor } = ctx;
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    ctx.ui.toast('Hãy chọn đoạn chữ cần đổi kiểu', true);
    return;
  }
  const tr = editor.state.tr;
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.text.length);
    const slice = node.text.slice(start - pos, end - pos);
    const next = transformCase(slice, mode);
    if (next !== slice) tr.insertText(next, tr.mapping.map(start), tr.mapping.map(end));
  });
  editor.view.dispatch(tr);
};

export const sortParagraphs = async (ctx: DocCtx) => {
  const { editor } = ctx;
  const res = await ctx.ui.ask({ title: 'Sắp xếp đoạn văn', message: 'Sắp xếp các đoạn/dòng đang chọn (hoặc các mục của danh sách chứa con trỏ).', fields: [{ name: 'order', label: 'Thứ tự', type: 'select', value: 'asc', options: [{ value: 'asc', label: 'A → Z (tăng dần)' }, { value: 'desc', label: 'Z → A (giảm dần)' }] }], confirmText: 'Sắp xếp' });
  if (!res) return;
  const { $from, $to } = editor.state.selection;
  const LIST_TYPES = ['bulletList', 'orderedList', 'taskList'];
  let depth = $from.depth;
  while (depth > 0 && !LIST_TYPES.includes($from.node(depth).type.name)) depth--;
  const container = depth > 0 ? $from.node(depth) : editor.state.doc;
  const containerStart = depth > 0 ? $from.before(depth) + 1 : 0;
  const firstIndex = depth > 0 ? 0 : $from.index(0);
  const lastIndex = depth > 0 ? container.childCount - 1 : $to.index(0);
  const children: { node: import('@tiptap/pm/model').Node; text: string }[] = [];
  let from = containerStart;
  let to = containerStart;
  container.forEach((child, offset, index) => {
    if (index < firstIndex || index > lastIndex) return;
    if (!children.length) from = containerStart + offset;
    to = containerStart + offset + child.nodeSize;
    children.push({ node: child, text: child.textContent });
  });
  if (children.length < 2) {
    ctx.ui.toast('Hãy chọn ít nhất 2 đoạn (hoặc đặt con trỏ trong danh sách) để sắp xếp', true);
    return;
  }
  const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
  const sorted = [...children].sort((a, b) => collator.compare(a.text, b.text) * (res.order === 'desc' ? -1 : 1));
  editor.view.dispatch(editor.state.tr.replaceWith(from, to, sorted.map((item) => item.node)));
  ctx.ui.toast(`Đã sắp xếp ${children.length} mục`);
};

export const pageSetup = async (ctx: DocCtx) => {
  const cm = (px: number) => (px / 37.8).toFixed(2);
  const res = await ctx.ui.ask({
    title: 'Thiết lập trang',
    fields: [
      { name: 'size', label: 'Khổ giấy', type: 'select', value: ctx.page.size, options: [{ value: 'A4', label: 'A4 (21 × 29,7 cm)' }, { value: 'A5', label: 'A5 (14,8 × 21 cm)' }, { value: 'Letter', label: 'Letter (8,5 × 11 in)' }, { value: 'Legal', label: 'Legal (8,5 × 14 in)' }] },
      { name: 'orientation', label: 'Hướng giấy', type: 'select', value: ctx.page.orientation, options: [{ value: 'portrait', label: 'Dọc' }, { value: 'landscape', label: 'Ngang' }] },
      { name: 'top', label: 'Lề trên (cm)', type: 'number', value: cm(ctx.page.margins.top) },
      { name: 'bottom', label: 'Lề dưới (cm)', type: 'number', value: cm(ctx.page.margins.bottom) },
      { name: 'left', label: 'Lề trái (cm)', type: 'number', value: cm(ctx.page.margins.left) },
      { name: 'right', label: 'Lề phải (cm)', type: 'number', value: cm(ctx.page.margins.right) },
    ],
    confirmText: 'Áp dụng',
  });
  if (!res) return;
  const px = (value: unknown, fallback: number) => {
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 && n < 10 ? Math.round(n * 37.8) : fallback;
  };
  ctx.setPage({
    size: res.size as PageSettings['size'],
    orientation: res.orientation as PageSettings['orientation'],
    margins: { top: px(res.top, ctx.page.margins.top), bottom: px(res.bottom, ctx.page.margins.bottom), left: px(res.left, ctx.page.margins.left), right: px(res.right, ctx.page.margins.right) },
  });
};

export const headerFooterSetup = async (ctx: DocCtx) => {
  const res = await ctx.ui.ask({
    title: 'Đầu trang & chân trang',
    fields: [
      { name: 'header', label: 'Nội dung đầu trang', value: ctx.page.header },
      { name: 'footer', label: 'Nội dung chân trang', value: ctx.page.footer },
      { name: 'pageNumbers', label: 'Đánh số trang (Trang x / y)', type: 'checkbox', value: ctx.page.pageNumbers },
      { name: 'differentFirstPage', label: 'Trang đầu khác (ẩn đầu/chân trang ở trang 1)', type: 'checkbox', value: Boolean(ctx.page.differentFirstPage) },
    ],
    confirmText: 'Áp dụng',
  });
  if (res) ctx.setPage({ header: String(res.header), footer: String(res.footer), pageNumbers: Boolean(res.pageNumbers), differentFirstPage: Boolean(res.differentFirstPage) });
};

export const paragraphSettings = async (ctx: DocCtx) => {
  const { editor } = ctx;
  const attrs = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph');
  const res = await ctx.ui.ask({
    title: 'Đoạn văn',
    fields: [
      { name: 'indent', label: 'Thụt lề trái (bậc, mỗi bậc 1,27 cm)', type: 'number', value: Number(attrs.indent) || 0, min: 0, max: 8 },
      { name: 'before', label: 'Khoảng cách trước đoạn (pt)', type: 'number', value: attrs.spaceBefore ?? 0, min: 0, max: 96 },
      { name: 'after', label: 'Khoảng cách sau đoạn (pt)', type: 'number', value: attrs.spaceAfter ?? 9, min: 0, max: 96 },
      { name: 'line', label: 'Giãn dòng (bội số)', type: 'select', value: String(attrs.lineHeight ?? '1.15'), options: ['1', '1.15', '1.5', '2', '2.5', '3'].map((v) => ({ value: v, label: v })) },
      { name: 'align', label: 'Căn lề', type: 'select', value: String(attrs.textAlign ?? 'left'), options: [{ value: 'left', label: 'Trái' }, { value: 'center', label: 'Giữa' }, { value: 'right', label: 'Phải' }, { value: 'justify', label: 'Đều hai bên' }] },
    ],
    confirmText: 'Áp dụng',
  });
  if (!res) return;
  editor.chain().focus().setIndentLevel(Number(res.indent) || 0).setParagraphSpacing(Number(res.before) || 0, Number(res.after) || 0).setLineHeight(parseFloat(String(res.line)) || null).setTextAlign(String(res.align)).run();
};

export const customWatermark = async (ctx: DocCtx) => {
  const res = await ctx.ui.ask({ title: 'Hình mờ tuỳ chỉnh', fields: [{ name: 'text', label: 'Nội dung hình mờ', value: ctx.page.watermark ?? '', placeholder: 'BẢN NHÁP' }], confirmText: 'Áp dụng' });
  if (res) ctx.setPage({ watermark: String(res.text).trim() });
};

const newDocMeta = (name: string, preview: string): FileMeta => ({ id: newId('doc'), name, kind: 'doc', createdAt: Date.now(), updatedAt: Date.now(), openedAt: Date.now(), starred: false, deletedAt: null, size: preview.length * 2, preview: preview.slice(0, 160) });

export const splitDocument = async (ctx: DocCtx) => {
  const res = await ctx.ui.ask({ title: 'Tách tài liệu', message: 'Mỗi tiêu đề ở cấp đã chọn sẽ thành một tài liệu riêng trong Minh Office.', fields: [{ name: 'level', label: 'Tách theo', type: 'select', value: '1', options: [{ value: '1', label: 'Heading 1' }, { value: '2', label: 'Heading 1 và 2' }] }], confirmText: 'Tách' });
  if (!res) return;
  const sections = splitByHeading(ctx.editor.getJSON(), Number(res.level));
  if (sections.length < 2) {
    ctx.ui.toast('Không đủ tiêu đề để tách (cần ít nhất 2 phần)', true);
    return;
  }
  await run(ctx, 'Đang tách tài liệu…', async () => {
    for (const [index, section] of sections.entries()) {
      const json: JSONContent = { type: 'doc', content: section.content };
      await ctx.storage.saveFile(newDocMeta(`${baseName(ctx)} - ${index + 1}. ${section.title.slice(0, 50)}.docx`, jsonText(json)), { kind: 'doc', json, page: ctx.page });
    }
    ctx.ui.toast(`Đã tách thành ${sections.length} tài liệu mới trong danh sách tệp`);
  }, 'Không tách được tài liệu');
};

export const mergeDocument = async (ctx: DocCtx) => {
  const file = await pickFile('.docx,.html,.htm,.txt,.md');
  if (!file) return;
  await run(ctx, `Đang ghép “${file.name}”…`, async () => {
    const lower = file.name.toLowerCase();
    let content: string;
    if (lower.endsWith('.docx')) content = (await importDocxFull(await file.arrayBuffer()).catch(async () => ({ html: await importDocx(await file.arrayBuffer()) }))).html;
    else if (lower.endsWith('.html') || lower.endsWith('.htm')) content = (await file.text()).replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, '');
    else content = (await file.text()).split(/\n{2,}/).map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c).replace(/\n/g, '<br>')}</p>`).join('');
    const end = ctx.editor.state.doc.content.size;
    ctx.editor.chain().focus().insertContentAt(end, [{ type: 'pageBreak' }]).insertContentAt(ctx.editor.state.doc.content.size, content).run();
    ctx.ui.toast(`Đã ghép “${file.name}” vào cuối tài liệu`);
  }, 'Không ghép được tệp');
};

export const toggleProtection = async (ctx: DocCtx) => {
  if (ctx.page.protectHash) {
    const res = await ctx.ui.ask({ title: 'Bỏ hạn chế chỉnh sửa', fields: [{ name: 'password', label: 'Mật khẩu', type: 'password' }], confirmText: 'Mở khoá', validate: async (v) => ((await sha256(String(v.password))) === ctx.page.protectHash ? null : 'Mật khẩu không đúng') });
    if (!res) return;
    ctx.setPage({ protectHash: undefined });
    ctx.setView({ editMode: 'editing' });
    ctx.ui.toast('Đã bỏ hạn chế chỉnh sửa');
    return;
  }
  const res = await ctx.ui.ask({ title: 'Hạn chế chỉnh sửa', message: 'Tài liệu chuyển sang chỉ xem cho tới khi nhập đúng mật khẩu.', fields: [{ name: 'password', label: 'Mật khẩu', type: 'password' }, { name: 'confirm', label: 'Nhập lại mật khẩu', type: 'password' }], confirmText: 'Bảo vệ', validate: (v) => (!String(v.password) ? 'Hãy nhập mật khẩu' : v.password !== v.confirm ? 'Hai mật khẩu không khớp' : null) });
  if (!res) return;
  ctx.setPage({ protectHash: await sha256(String(res.password)) });
  ctx.setView({ editMode: 'viewing' });
  ctx.ui.toast('Tài liệu đã được bảo vệ, chỉ xem');
};

export const pastePlainText = async (ctx: DocCtx) => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) ctx.editor.chain().focus().insertContent(text.split(/\r?\n/).map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }))).run();
  } catch {
    ctx.ui.toast('Trình duyệt chặn đọc clipboard — dùng Ctrl+Shift+V để dán dạng chữ thuần', true);
  }
};

export const pasteRich = async (ctx: DocCtx) => {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        ctx.editor.chain().focus().insertContent(await (await item.getType('text/html')).text()).run();
        return;
      }
      const image = item.types.find((t) => t.startsWith('image/'));
      if (image) {
        ctx.editor.chain().focus().setImage({ src: await readAsDataUrl(await item.getType(image)) }).run();
        return;
      }
    }
    await pastePlainText(ctx);
  } catch {
    ctx.ui.toast('Trình duyệt chặn đọc clipboard — dùng Ctrl+V để dán', true);
  }
};

export const copySelection = (ctx: DocCtx, cut: boolean) => {
  ctx.editor.commands.focus();
  const ok = document.execCommand(cut ? 'cut' : 'copy');
  if (!ok) ctx.ui.toast(cut ? 'Dùng Ctrl+X để cắt' : 'Dùng Ctrl+C để sao chép', true);
};

export const imageSettings = async (ctx: DocCtx) => {
  const attrs = ctx.editor.getAttributes('image');
  const res = await ctx.ui.ask({ title: 'Định dạng ảnh', fields: [{ name: 'width', label: 'Chiều rộng (% khổ trang)', type: 'number', value: parseInt(String(attrs.width ?? '100'), 10) || 100, min: 5, max: 100 }, { name: 'alt', label: 'Mô tả ảnh (alt text)', value: attrs.alt ?? '' }, { name: 'align', label: 'Bố cục', type: 'select', value: attrs.align ?? 'inline', options: [{ value: 'inline', label: 'Cùng dòng với chữ' }, { value: 'center', label: 'Giữa trang' }, { value: 'left', label: 'Trái, chữ bao quanh' }, { value: 'right', label: 'Phải, chữ bao quanh' }] }], confirmText: 'Áp dụng' });
  if (!res) return;
  ctx.editor.chain().focus().setImageLayout({ width: `${Math.max(5, Math.min(100, Number(res.width) || 100))}%`, alt: String(res.alt), align: String(res.align) }).run();
};

export const readFileAsText = async (accept: string) => {
  const file = await pickFile(accept);
  return file ? { name: file.name, file } : null;
};
