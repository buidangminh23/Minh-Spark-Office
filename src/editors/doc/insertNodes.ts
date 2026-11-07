import { Extension, Node, mergeAttributes, type Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import type { DocProperties } from '../../lib/storage';
import { getRefs } from './extensionsExtra';
import { getPagination, pageAtPos } from './pagination';
import { FLATTEN_EXTRA } from './docFlattenExtra';
import { NODE_EDITORS } from './nodeEditors';
import { defaultFormat, formatDate, type FieldKind } from './insertFields';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoEmbed: { insertVideoEmbed: (url: string, width?: number) => ReturnType };
    docField: { insertDocField: (kind: FieldKind, format?: string) => ReturnType };
    fileObject: { insertFileObject: (attrs: { name: string; size: number; mime: string; data: string }) => ReturnType };
    esignField: { insertEsignField: (attrs: { kind: string; signer: string }) => ReturnType };
  }
}

const attrOf = (name: string, attribute: string, fallback: unknown = '') => ({
  default: fallback,
  parseHTML: (element: HTMLElement) => element.getAttribute(attribute) ?? fallback,
  renderHTML: (attributes: Record<string, unknown>) => (attributes[name] === null || attributes[name] === '' || attributes[name] === undefined ? {} : { [attribute]: attributes[name] }),
});

const fieldId = () => `f${Math.random().toString(36).slice(2, 10)}`;

type FieldInfo = { title: string; properties: DocProperties };
type FieldInfoStorage = { info: FieldInfo };

export const DocFieldInfo = Extension.create<Record<string, never>, FieldInfoStorage>({
  name: 'docFieldInfo',
  addStorage() {
    return { info: { title: '', properties: {} } };
  },
});

const fieldInfo = (editor: Editor) => (editor.storage as unknown as { docFieldInfo: FieldInfoStorage }).docFieldInfo.info;

export const setFieldInfo = (editor: Editor, info: FieldInfo) => {
  const storage = (editor.storage as unknown as { docFieldInfo: FieldInfoStorage }).docFieldInfo;
  if (storage.info.title === info.title && JSON.stringify(storage.info.properties) === JSON.stringify(info.properties)) return;
  storage.info = info;
  getRefs(editor).listeners.forEach((listener) => listener());
};

const PLACEHOLDERS: Partial<Record<FieldKind, string>> = { subject: '[Chủ đề]', keywords: '[Từ khoá]', company: '[Đơn vị]' };

export function fieldText(editor: Editor, attrs: Record<string, unknown>, pos: number | null = null) {
  const kind = String(attrs.kind) as FieldKind;
  const info = fieldInfo(editor);
  switch (kind) {
    case 'page': return String(pos === null ? pageAtPos(editor, editor.state.selection.from) : pageAtPos(editor, pos));
    case 'numpages': return String(getPagination(editor).result.pages);
    case 'numwords': {
      const counter = (editor.storage as unknown as { characterCount?: { words?: () => number } }).characterCount;
      return String(counter?.words?.() ?? 0);
    }
    case 'date':
    case 'time': return formatDate(String(attrs.format || defaultFormat(kind)));
    case 'filename': return info.title;
    case 'title': return info.title.replace(/\.[^/.]+$/, '');
    case 'author': return info.properties.author || 'Minh Spark';
    default: return info.properties[kind as 'subject' | 'keywords' | 'company'] || PLACEHOLDERS[kind] || '';
  }
}

const findFieldPos = (editor: Editor, id: string) => {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found === null && node.type.name === 'docField' && node.attrs.fid === id) found = pos;
    return found === null;
  });
  return found;
};

export const DocField = Node.create({
  name: 'docField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: attrOf('kind', 'data-field-kind', 'date'),
      format: attrOf('format', 'data-field-format', ''),
      fid: attrOf('fid', 'data-field-id', ''),
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-field-kind]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-field' })];
  },
  renderText({ node }) {
    const kind = String(node.attrs.kind);
    return kind === 'date' || kind === 'time' ? formatDate(String(node.attrs.format || defaultFormat(kind))) : '';
  },
  addNodeView() {
    return ({ editor, node, getPos }) => {
      const dom = document.createElement('span');
      dom.className = 'doc-field';
      dom.setAttribute('data-field-kind', String(node.attrs.kind));
      let attrs = node.attrs;
      const render = () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        const text = fieldText(editor, attrs, pos ?? null);
        if (dom.textContent !== text) dom.textContent = text;
      };
      render();
      const refs = getRefs(editor);
      const pagination = getPagination(editor);
      refs.listeners.add(render);
      pagination.listeners.add(render);
      editor.on('update', render);
      return {
        dom,
        ignoreMutation: () => true,
        update: (updated) => {
          if (updated.type.name !== 'docField') return false;
          attrs = updated.attrs;
          render();
          return true;
        },
        destroy: () => {
          refs.listeners.delete(render);
          pagination.listeners.delete(render);
          editor.off('update', render);
        },
      };
    };
  },
  addCommands() {
    return {
      insertDocField: (kind, format) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { kind, format: format ?? defaultFormat(kind), fid: fieldId() } }),
    };
  },
});

export function videoEmbedUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    const id = url.searchParams.get('v') ?? /^\/(?:embed|shorts|live)\/([^/?]+)/.exec(url.pathname)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = /(\d{6,})/.exec(url.pathname)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      url: attrOf('url', 'data-url', ''),
      width: {
        default: 100,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-width')) || 100,
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-width': attributes.width }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const url = String(node.attrs.url);
    const embed = videoEmbedUrl(url);
    return ['div', mergeAttributes(HTMLAttributes, { 'data-video-embed': 'true', class: 'doc-video', style: `width: ${node.attrs.width}%` }),
      ['div', { class: 'doc-video-handle', contenteditable: 'false', title: 'Bấm để chọn, kéo để di chuyển video', 'aria-label': 'Chọn video' }],
      embed ? ['iframe', { src: embed, title: 'Video trực tuyến', loading: 'lazy', allowfullscreen: 'true', referrerpolicy: 'strict-origin-when-cross-origin', allow: 'encrypted-media; picture-in-picture' }] : ['a', { href: url }, url],
    ];
  },
  renderText({ node }) {
    return String(node.attrs.url);
  },
  addCommands() {
    return {
      insertVideoEmbed: (url, width = 100) => ({ commands }) => commands.insertContent([{ type: this.name, attrs: { url, width } }, { type: 'paragraph' }]),
    };
  },
});

export const FileObject = Node.create({
  name: 'fileObject',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      name: attrOf('name', 'data-file-name', 'tep'),
      size: {
        default: 0,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-file-size')) || 0,
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-file-size': attributes.size }),
      },
      mime: attrOf('mime', 'data-file-mime', 'application/octet-stream'),
      data: attrOf('data', 'data-file-object', ''),
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-file-object]', priority: 60 }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['a', mergeAttributes(HTMLAttributes, { class: 'file-object', download: node.attrs.name, title: `Nhấp đúp để tải ${node.attrs.name}` }), String(node.attrs.name)];
  },
  renderText({ node }) {
    return String(node.attrs.name);
  },
  addCommands() {
    return {
      insertFileObject: (attrs) => ({ commands }) => commands.insertContent([{ type: this.name, attrs }, { type: 'text', text: ' ' }]),
    };
  },
});

export const ESIGN_KINDS: { id: string; label: string }[] = [
  { id: 'signature', label: 'Chữ ký' },
  { id: 'initials', label: 'Chữ ký tắt' },
  { id: 'name', label: 'Họ và tên' },
  { id: 'date', label: 'Ngày ký' },
  { id: 'text', label: 'Nội dung khác' },
];

export const esignLabel = (attrs: Record<string, unknown>) => `${ESIGN_KINDS.find((item) => item.id === attrs.kind)?.label ?? 'Trường ký'}${attrs.signer ? `: ${attrs.signer}` : ''}`;

export const ESignField = Node.create({
  name: 'esignField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: attrOf('kind', 'data-esign-kind', 'signature'),
      signer: attrOf('signer', 'data-esign-signer', ''),
      value: attrOf('value', 'data-esign-value', ''),
      image: attrOf('image', 'data-esign-image', ''),
      signedAt: attrOf('signedAt', 'data-esign-at', ''),
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-esign-kind]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const { image, value } = node.attrs;
    const filled = Boolean(image || value);
    const base = mergeAttributes(HTMLAttributes, { class: `esign-field ${filled ? 'filled' : 'empty'}`, title: 'Nhấp đúp để ký' });
    if (image) return ['span', base, ['img', { src: image, alt: esignLabel(node.attrs) }]];
    return ['span', base, value ? String(value) : esignLabel(node.attrs)];
  },
  renderText({ node }) {
    return String(node.attrs.value || `[${esignLabel(node.attrs)}]`);
  },
  addCommands() {
    return {
      insertEsignField: (attrs) => ({ commands }) => commands.insertContent([{ type: this.name, attrs }, { type: 'text', text: ' ' }]),
    };
  },
});

export const CoverAttribute = Extension.create({
  name: 'coverAttribute',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        cover: {
          default: false,
          parseHTML: (element: HTMLElement) => element.hasAttribute('data-cover'),
          renderHTML: (attributes: Record<string, unknown>) => (attributes.cover ? { 'data-cover': 'true' } : {}),
        },
      },
    }];
  },
});

const textNode = (text: string, marks?: JSONContent['marks']): JSONContent[] => (text ? [{ type: 'text', text, ...(marks ? { marks } : {}) }] : []);

FLATTEN_EXTRA.docField = (node, editor) => {
  const kind = String(node.attrs?.kind);
  const id = String(node.attrs?.fid ?? '');
  const pos = kind === 'page' && id ? findFieldPos(editor, id) : null;
  return textNode(fieldText(editor, node.attrs ?? {}, pos), node.marks);
};

FLATTEN_EXTRA.videoEmbed = (node) => {
  const url = String(node.attrs?.url ?? '');
  return [{ type: 'paragraph', content: [{ type: 'text', text: 'Video: ' }, { type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }] }];
};

FLATTEN_EXTRA.fileObject = (node) => textNode(`[Tệp đính kèm: ${String(node.attrs?.name ?? '')}]`, node.marks);

FLATTEN_EXTRA.esignField = (node) => {
  const attrs = node.attrs ?? {};
  if (attrs.image) return [{ type: 'image', attrs: { src: String(attrs.image), alt: esignLabel(attrs), width: '30%', align: 'inline' } }];
  return textNode(attrs.value ? String(attrs.value) : `[${esignLabel(attrs)}]`, node.marks);
};

NODE_EDITORS.fileObject = (ctx, node) => {
  const link = document.createElement('a');
  link.href = String(node.attrs.data);
  link.download = String(node.attrs.name);
  link.click();
  ctx.ui.toast(`Đang tải ${String(node.attrs.name)}`);
  return true;
};

NODE_EDITORS.esignField = (ctx, node, pos) => {
  ctx.setEditing({ pos, attrs: node.attrs });
  ctx.openDialog('esign');
  return true;
};
