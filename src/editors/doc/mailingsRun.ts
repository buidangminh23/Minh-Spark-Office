import type { JSONContent } from '@tiptap/react';
import { DOMSerializer, Node as PMNode, type Schema } from '@tiptap/pm/model';
import { exportDocx } from '../../lib/docxConvertLazy';
import { downloadBlob } from '../../lib/download';
import { basePage, type DocContent, type FileMeta, type PageSettings } from '../../lib/storage';
import { newId, type DocCtx } from './DocContext';
import { jsonText } from './docTools';
import { requestPrintOnOpen } from './docLaunch';
import { collectFields, fillTokens, parseOptions, renderAll, type MergeType } from './mailMerge';

const MAX_FILES = 300;

export const mergeTypeOf = (ctx: DocCtx): MergeType => ctx.page.mergeType ?? 'letters';

export async function askFillIns(ctx: DocCtx, doc: JSONContent): Promise<Record<string, string> | null> {
  const prompts = new Map<string, string>();
  for (const block of collectFields(doc).blocks) {
    if (block.kind !== 'fillin') continue;
    const options = parseOptions(block.options, { prompt: '', value: '' });
    if (options.prompt) prompts.set(options.prompt, options.value);
  }
  if (!prompts.size) return {};
  const fields = [...prompts].map(([prompt, value], index) => ({ name: `f${index}`, label: prompt, value }));
  const res = await ctx.ui.ask({ title: 'Điền thông tin khi trộn', fields, confirmText: 'Tiếp tục' });
  if (!res) return null;
  return Object.fromEntries([...prompts.keys()].map((prompt, index) => [prompt, String(res[`f${index}`] ?? '')]));
}

async function confirmFields(ctx: DocCtx, doc: JSONContent) {
  const { fields, blocks } = collectFields(doc);
  if (fields.length || blocks.some((block) => block.kind !== 'next')) return true;
  return ctx.ui.confirm('Chưa có trường trộn nào', 'Tài liệu chưa chèn «trường» nào nên mọi bản sẽ giống hệt nhau. Vẫn tiếp tục?');
}

export async function mergedInstances(ctx: DocCtx) {
  const merge = ctx.merge;
  if (!merge?.rows.length) return null;
  const doc = ctx.editor.getJSON();
  if (!(await confirmFields(ctx, doc))) return null;
  const answers = await askFillIns(ctx, doc);
  if (!answers) return null;
  const instances = renderAll(doc, merge, answers);
  if (!instances.length) {
    ctx.ui.toast('Không còn bản ghi nào sau khi áp dụng quy tắc và bộ lọc', true);
    return null;
  }
  return instances;
}

const baseName = (ctx: DocCtx) => ctx.title.replace(/\.[^/.]+$/, '');

export async function saveNewDoc(ctx: DocCtx, name: string, json: JSONContent, page: PageSettings) {
  const meta: FileMeta = { id: newId('doc'), name, kind: 'doc', createdAt: Date.now(), updatedAt: Date.now(), openedAt: Date.now(), starred: false, deletedAt: null, size: JSON.stringify(json).length, preview: jsonText(json).slice(0, 160) };
  const content: DocContent = { kind: 'doc', json, page };
  await ctx.storage.saveFile(meta, content);
  return { meta, content };
}

export const mergedPage = (page: PageSettings): PageSettings => {
  const next = { ...page };
  delete next.mergeType;
  delete next.mergeEmail;
  return next;
};

export async function finishMerge(ctx: DocCtx, mode: 'single' | 'files' | 'print') {
  const instances = await mergedInstances(ctx);
  if (!instances) return;
  const base = baseName(ctx);
  try {
    if (mode === 'files') {
      const items = instances.slice(0, MAX_FILES);
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const firstKey = ctx.merge?.headers[0] ?? '';
      for (const [index, item] of items.entries()) {
        ctx.ui.showBusy(`Đang tạo tệp ${index + 1}/${items.length}…`);
        const label = (ctx.merge?.rows[item.first]?.[firstKey] || 'ban-ghi').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
        zip.file(`${String(index + 1).padStart(3, '0')} - ${label}.docx`, await exportDocx(item.json, mergedPage(ctx.page), base));
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base} - tron thu.zip`);
      ctx.ui.toast(`Đã tải ${items.length} tệp .docx (nén trong .zip)${instances.length > MAX_FILES ? `, giới hạn ${MAX_FILES} bản` : ''}`);
      return;
    }
    ctx.ui.showBusy(`Đang trộn ${instances.length} bản…`);
    const separate = mergeTypeOf(ctx) !== 'directory';
    const content: JSONContent[] = [];
    instances.forEach((item, index) => {
      content.push(...(item.json.content ?? []));
      if (separate && index < instances.length - 1) content.push({ type: 'pageBreak' });
    });
    const saved = await saveNewDoc(ctx, `${base} - đã trộn (${instances.length}).docx`, { type: 'doc', content }, mergedPage(ctx.page));
    if (mode === 'print') requestPrintOnOpen(saved.meta.id);
    ctx.ui.toast(mode === 'print' ? 'Đã tạo bản trộn, đang mở hộp thoại In' : `Đã tạo “${saved.meta.name}”`);
    ctx.onOpenSaved(saved.meta, saved.content);
  } catch (error) {
    ctx.ui.toast((error as Error).message || 'Trộn thư thất bại', true);
  } finally {
    ctx.ui.showBusy(null);
  }
}

export function jsonToHtml(schema: Schema, json: JSONContent): string {
  const node = PMNode.fromJSON(schema, json);
  const host = document.createElement('div');
  host.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(node.content));
  host.querySelectorAll('[contenteditable]').forEach((element) => element.removeAttribute('contenteditable'));
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; font-size: 11pt; color: #1f2430;">${host.innerHTML}</body></html>`;
}

export function jsonToPlain(json: JSONContent): string {
  const walk = (node: JSONContent): string => {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    const inner = (node.content ?? []).map(walk).join(node.type === 'tableRow' ? '\t' : '');
    return ['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'tableRow', 'codeBlock'].includes(node.type ?? '') ? `${inner}\n` : inner;
  };
  return walk(json).replace(/\n{3,}/g, '\n\n').trim();
}

export type BuiltMail = { record: number; to: string; cc: string; subject: string; body: string; html: boolean; attachments: { name: string; data: string; type: string }[] };

const blobToBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export async function buildMails(ctx: DocCtx, settings: { to: string; cc: string; subject: string; format: 'html' | 'text' | 'attachment' }): Promise<BuiltMail[] | null> {
  const instances = await mergedInstances(ctx);
  if (!instances || !ctx.merge) return null;
  const out: BuiltMail[] = [];
  const base = baseName(ctx);
  for (const [index, item] of instances.entries()) {
    const row = ctx.merge.rows[item.first] ?? {};
    const to = (row[settings.to] ?? '').trim();
    if (!to) continue;
    ctx.ui.showBusy(`Đang soạn thư ${index + 1}/${instances.length}…`);
    const subject = fillTokens(settings.subject, row);
    const cc = fillTokens(settings.cc, row);
    if (settings.format === 'attachment') {
      const data = await blobToBase64(await exportDocx(item.json, mergedPage(ctx.page), base));
      out.push({ record: item.first, to, cc, subject, body: `${subject}\n\nTài liệu đính kèm: ${base}.docx`, html: false, attachments: [{ name: `${base}.docx`, data, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }] });
    } else if (settings.format === 'html') {
      out.push({ record: item.first, to, cc, subject, body: jsonToHtml(ctx.editor.schema, item.json), html: true, attachments: [] });
    } else {
      out.push({ record: item.first, to, cc, subject, body: jsonToPlain(item.json), html: false, attachments: [] });
    }
  }
  ctx.ui.showBusy(null);
  return out;
}

export const envelopePage = (size: PageSettings['size']): PageSettings => ({ ...basePage(), size, orientation: 'landscape', margins: { top: 48, right: 48, bottom: 48, left: 48 }, pageNumbers: false });
