import type { JSONContent } from '@tiptap/react';

export function escapeConversionHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function textConversionDocument(text: string): JSONContent {
  return { type: 'doc', content: text.replace(/\r\n?/g, '\n').split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) };
}

export function conversionNodeText(node: JSONContent): string {
  if (node.type === 'hardBreak') return '\n';
  const separator = node.type === 'tableRow' ? '\t' : ['doc', 'table', 'tableCell', 'tableHeader', 'listItem', 'blockquote'].includes(node.type ?? '') ? '\n' : '';
  return node.text ?? (node.content ?? []).map(conversionNodeText).join(separator);
}

export function htmlConversionDocument(html: string): { json: JSONContent; warnings: string[] } {
  const template = document.createElement('template');
  template.innerHTML = html;
  const parsed = template.content;
  parsed.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,svg,math').forEach((element) => element.remove());
  const warnings = new Set<string>();
  let visited = 0;
  const parse = (node: Node, marks: NonNullable<JSONContent['marks']> = [], depth = 0): JSONContent[] => {
    visited += 1;
    if (visited > 100_000 || depth > 100) throw new Error('Tài liệu quá phức tạp để chuyển đổi trong trình duyệt.');
    if (node.nodeType === 3) return node.textContent ? [{ type: 'text', text: node.textContent, ...(marks.length ? { marks } : {}) }] : [];
    if (node.nodeType !== 1) return [];
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const markTypes: Record<string, string> = { strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline', s: 'strike', del: 'strike', sub: 'subscript', sup: 'superscript', code: 'code' };
    const nextMarks = [...marks];
    if (markTypes[tag]) nextMarks.push({ type: markTypes[tag] });
    if (tag === 'a') {
      const href = element.getAttribute('href') ?? '';
      if (/^(https?:|mailto:|#)/i.test(href)) nextMarks.push({ type: 'link', attrs: { href } });
    }
    if (tag === 'img') {
      const src = element.getAttribute('src') ?? '';
      if (!/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) {
        warnings.add('Ảnh ngoài tệp hoặc định dạng ảnh chưa hỗ trợ được thay bằng mô tả; không tải tài nguyên từ liên kết ngoài.');
        const alt = element.getAttribute('alt');
        return [{ type: 'text', text: alt ? `[Ảnh: ${alt}]` : '[Ảnh chưa được chuyển đổi]' }];
      }
      const width = parseFloat(element.getAttribute('width') ?? '');
      const height = parseFloat(element.getAttribute('height') ?? '');
      return [{ type: 'image', attrs: { src, alt: element.getAttribute('alt') ?? '', ...(width > 0 && width <= 16384 ? { width } : {}), ...(height > 0 && height <= 16384 ? { height } : {}) } }];
    }
    if (tag === 'br') return [{ type: 'hardBreak' }];
    if (tag === 'hr') return [{ type: 'horizontalRule' }];
    const content = Array.from(element.childNodes).flatMap((child) => parse(child, nextMarks, depth + 1));
    if (/^h[1-6]$/.test(tag)) return [{ type: 'heading', attrs: { level: Number(tag[1]) }, content }];
    if (tag === 'p') return [{ type: 'paragraph', content }];
    if (tag === 'pre') return [{ type: 'codeBlock', content: [{ type: 'text', text: element.textContent ?? '' }] }];
    if (tag === 'blockquote') return [{ type: 'blockquote', content: blockify(content) }];
    if (tag === 'ul' || tag === 'ol') return [{ type: tag === 'ul' ? 'bulletList' : 'orderedList', content }];
    if (tag === 'li') return [{ type: 'listItem', content: blockify(content) }];
    if (tag === 'table') return [{ type: 'table', content: content.filter((item) => item.type === 'tableRow') }];
    if (tag === 'tr') return [{ type: 'tableRow', content: content.filter((item) => item.type === 'tableCell' || item.type === 'tableHeader') }];
    if (tag === 'td' || tag === 'th') return [{ type: tag === 'td' ? 'tableCell' : 'tableHeader', attrs: { colspan: Math.min(100, Math.max(1, Number(element.getAttribute('colspan')) || 1)), rowspan: Math.min(1000, Math.max(1, Number(element.getAttribute('rowspan')) || 1)) }, content: blockify(content) }];
    if (['div', 'section', 'article', 'header', 'footer'].includes(tag)) return blockify(content);
    return content;
  };
  return { json: { type: 'doc', content: blockify(Array.from(parsed.childNodes).flatMap((node) => parse(node))) }, warnings: [...warnings] };
}

function blockify(content: JSONContent[]): JSONContent[] {
  const result: JSONContent[] = [];
  let inline: JSONContent[] = [];
  const flush = () => {
    if (inline.some((node) => node.type !== 'text' || node.text?.trim())) result.push({ type: 'paragraph', content: inline });
    inline = [];
  };
  for (const node of content) {
    if (['text', 'hardBreak'].includes(node.type ?? '')) inline.push(node);
    else { flush(); result.push(node); }
  }
  flush();
  return result;
}

export function conversionDocumentHtml(json: JSONContent, title: string): string {
  const render = (node: JSONContent): string => {
    const content = () => (node.content ?? []).map(render).join('');
    if (node.type === 'text') {
      let text = escapeConversionHtml(node.text ?? '');
      const tags: Record<string, string> = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', subscript: 'sub', superscript: 'sup', code: 'code' };
      for (const mark of node.marks ?? []) {
        const tag = tags[mark.type];
        if (tag) text = `<${tag}>${text}</${tag}>`;
        else if (mark.type === 'link' && /^(https?:|mailto:|#)/i.test(String(mark.attrs?.href ?? ''))) text = `<a href="${escapeConversionHtml(String(mark.attrs!.href))}">${text}</a>`;
      }
      return text;
    }
    if (node.type === 'image') return `<img src="${escapeConversionHtml(String(node.attrs?.src ?? ''))}" alt="${escapeConversionHtml(String(node.attrs?.alt ?? ''))}">`;
    if (node.type === 'hardBreak') return '<br>';
    if (node.type === 'horizontalRule' || node.type === 'pageBreak') return '<hr>';
    if (node.type === 'heading') { const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1)); return `<h${level}>${content()}</h${level}>`; }
    if (node.type === 'tableCell' || node.type === 'tableHeader') {
      const tag = node.type === 'tableCell' ? 'td' : 'th';
      const widths = node.attrs?.colwidth as number[] | undefined;
      const width = widths?.reduce((sum, value) => sum + value, 0);
      return `<${tag} colspan="${Number(node.attrs?.colspan) || 1}" rowspan="${Number(node.attrs?.rowspan) || 1}"${width && Number.isFinite(width) ? ` style="width:${Math.round(width)}px"` : ''}>${content()}</${tag}>`;
    }
    const tags: Record<string, string> = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', table: 'table', tableRow: 'tr', codeBlock: 'pre', blockquote: 'blockquote' };
    const tag = tags[node.type ?? ''];
    return tag ? `<${tag}>${content()}</${tag}>` : content();
  };
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeConversionHtml(title)}</title><style>body{font:16px/1.6 Arial,sans-serif;max-width:1000px;margin:40px auto;padding:0 24px;color:#172033}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #ccd2dc;padding:6px;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0}}</style></head><body>${render(json)}</body></html>`;
}
