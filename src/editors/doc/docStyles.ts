import type { Editor } from '@tiptap/react';
import type { DocStyleDef, PageSettings } from '../../lib/storage';

export const BUILTIN_STYLE_ORDER = ['normal', 'title', 'subtitle', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'quote'] as const;

export const BASE_STYLES: Record<string, DocStyleDef> = {
  normal: { name: 'Normal', after: 6, line: 1.5 },
  title: { name: 'Title', size: 28, color: '#1f3864', align: 'center', after: 12, line: 1.15 },
  subtitle: { name: 'Subtitle', size: 14, color: '#5a6478', align: 'center', after: 12, line: 1.2 },
  h1: { name: 'Heading 1', size: 24, bold: true, color: '#1f3864', before: 18, after: 9, line: 1.2 },
  h2: { name: 'Heading 2', size: 18, bold: true, color: '#2b579a', before: 18, after: 6, line: 1.25 },
  h3: { name: 'Heading 3', size: 15, bold: true, color: '#1f3864', before: 12, after: 6, line: 1.3 },
  h4: { name: 'Heading 4', size: 13, bold: true, italic: true, color: '#2b579a', before: 12, after: 3, line: 1.3 },
  h5: { name: 'Heading 5', size: 12, bold: true, color: '#5a6478', before: 9, after: 3, line: 1.3 },
  h6: { name: 'Heading 6', size: 12, italic: true, color: '#586071', before: 9, after: 3, line: 1.3 },
  quote: { name: 'Quote', italic: true, color: '#555f73', after: 6 },
};

const set = (overrides: Record<string, Partial<DocStyleDef>>) => Object.fromEntries(Object.entries(BASE_STYLES).map(([id, def]) => [id, { ...def, ...overrides[id] }]));

export const STYLE_SETS: { id: string; label: string; font: string; size: number; styles: Record<string, DocStyleDef> }[] = [
  { id: 'office', label: 'Mặc định', font: 'Arial', size: 12, styles: BASE_STYLES },
  {
    id: 'vn-admin', label: 'Hành chính Việt Nam', font: 'Times New Roman', size: 13,
    styles: set({
      normal: { after: 6, line: 1.3, align: 'justify' },
      title: { size: 16, bold: true, color: '#000000', caps: true, align: 'center' },
      subtitle: { size: 13, italic: true, color: '#000000' },
      h1: { size: 14, bold: true, color: '#000000', caps: true, before: 12, after: 6 },
      h2: { size: 13, bold: true, color: '#000000', before: 12, after: 6 },
      h3: { size: 13, bold: true, italic: true, color: '#000000', before: 6, after: 6 },
      h4: { size: 13, italic: true, color: '#000000', before: 6, after: 3, bold: false },
      quote: { color: '#000000' },
    }),
  },
  {
    id: 'modern', label: 'Hiện đại', font: 'Segoe UI', size: 11,
    styles: set({
      title: { size: 30, bold: false, color: '#0f172a', align: 'left' },
      subtitle: { size: 13, color: '#64748b', align: 'left' },
      h1: { size: 20, bold: false, color: '#0f766e' },
      h2: { size: 15, bold: false, color: '#0f766e' },
      h3: { size: 12, bold: true, color: '#134e4a' },
      quote: { color: '#475569' },
    }),
  },
  {
    id: 'classic', label: 'Cổ điển', font: 'Georgia', size: 12,
    styles: set({
      title: { size: 28, color: '#7c2d12' },
      subtitle: { color: '#78716c' },
      h1: { size: 20, color: '#7c2d12' },
      h2: { size: 16, color: '#9a3412' },
      h3: { size: 13, color: '#7c2d12' },
    }),
  },
  {
    id: 'report', label: 'Báo cáo', font: 'Calibri', size: 11,
    styles: set({
      title: { size: 26, color: '#1e3a8a', align: 'left' },
      subtitle: { size: 12, color: '#475569', align: 'left' },
      h1: { size: 16, color: '#1e3a8a', caps: true, before: 18, after: 6 },
      h2: { size: 13, color: '#1d4ed8' },
      h3: { size: 11, color: '#1e40af' },
      normal: { after: 8, line: 1.25 },
    }),
  },
  {
    id: 'minimal', label: 'Tối giản', font: 'Helvetica', size: 11,
    styles: set({
      title: { size: 24, bold: true, color: '#111827', align: 'left' },
      subtitle: { size: 12, color: '#6b7280', align: 'left' },
      h1: { size: 16, color: '#111827' },
      h2: { size: 13, color: '#111827' },
      h3: { size: 11, color: '#374151' },
      h4: { color: '#374151' },
      quote: { color: '#6b7280' },
    }),
  },
  {
    id: 'vibrant', label: 'Rực rỡ', font: 'Roboto', size: 11,
    styles: set({
      title: { size: 30, color: '#7c3aed' },
      subtitle: { color: '#db2777' },
      h1: { size: 20, color: '#7c3aed' },
      h2: { size: 15, color: '#db2777' },
      h3: { size: 12, color: '#ea580c' },
      quote: { color: '#7c3aed' },
    }),
  },
];

export const resolveStyles = (page: PageSettings) => ({ ...BASE_STYLES, ...(page.styles ?? {}) });

const declarations = (def: DocStyleDef) => {
  const out: string[] = [];
  if (def.font) out.push(`font-family: "${def.font}", Arial, sans-serif`);
  if (def.size) out.push(`font-size: ${def.size}pt`);
  if (def.color) out.push(`color: ${def.color}`);
  if (def.bold !== undefined) out.push(`font-weight: ${def.bold ? 700 : 400}`);
  if (def.italic !== undefined) out.push(`font-style: ${def.italic ? 'italic' : 'normal'}`);
  if (def.underline) out.push('text-decoration: underline');
  if (def.caps) out.push('text-transform: uppercase');
  if (def.align) out.push(`text-align: ${def.align}`);
  if (def.before !== undefined) out.push(`margin-top: ${def.before}pt`);
  if (def.after !== undefined) out.push(`margin-bottom: ${def.after}pt`);
  if (def.line) out.push(`line-height: ${def.line}`);
  return out.join('; ');
};

const selectorFor = (id: string) => {
  const root = '.doc-editor .doc-paper .tiptap';
  if (id === 'normal') return `${root} p:not([data-style])`;
  if (id === 'quote') return `${root} blockquote p`;
  if (/^h[1-6]$/.test(id)) return `${root} ${id}:not([data-style])`;
  return `${root} [data-style="${id}"]`;
};

export const styleSheetCss = (page: PageSettings) => Object.entries(resolveStyles(page)).map(([id, def]) => `${selectorFor(id)} { ${declarations(def)} }`).join('\n');

export function applyDocStyle(editor: Editor, id: string) {
  const chain = editor.chain().focus();
  if (id === 'normal') return chain.setParagraph().updateAttributes('paragraph', { styleId: null }).run();
  if (id === 'quote') return chain.toggleBlockquote().run();
  const level = /^h([1-6])$/.exec(id);
  if (level) return chain.setHeading({ level: Number(level[1]) as 1 | 2 | 3 | 4 | 5 | 6 }).updateAttributes('heading', { styleId: null }).run();
  return chain.setParagraph().updateAttributes('paragraph', { styleId: id }).run();
}

export function activeStyleId(editor: Editor) {
  if (editor.isActive('blockquote')) return 'quote';
  const heading = [1, 2, 3, 4, 5, 6].find((level) => editor.isActive('heading', { level }));
  if (heading) return `h${heading}`;
  return String(editor.getAttributes('paragraph').styleId ?? 'normal');
}

export function styleSample(def: DocStyleDef): React.CSSProperties {
  return {
    fontFamily: def.font,
    fontSize: def.size ? Math.min(16, Math.max(10, def.size * 0.72)) : undefined,
    color: def.color,
    fontWeight: def.bold === undefined ? undefined : def.bold ? 700 : 400,
    fontStyle: def.italic ? 'italic' : undefined,
    textDecoration: def.underline ? 'underline' : undefined,
    textTransform: def.caps ? 'uppercase' : undefined,
  };
}
