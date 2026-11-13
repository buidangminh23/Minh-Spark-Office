import JSZip from 'jszip';
import type { JSONContent } from '@tiptap/react';
import { fieldZones } from '../editors/doc/pageFormat';
import { PAGE_SIZES, type PageSettings } from './storage';

type Mark = { type: string; attrs?: Record<string, unknown> };

const TWIP = 15;
const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
const nodeText = (node?: JSONContent): string => (node?.text ?? '') + (node?.content ?? []).map(nodeText).join('');
const toHex = (color: unknown) => {
  const value = String(color ?? '');
  const short = /^#([0-9a-f]{3})$/i.exec(value);
  if (short) return short[1].split('').map((c) => c + c).join('').toLowerCase();
  const long = /^#([0-9a-f]{6})/i.exec(value);
  return long ? long[1].toLowerCase() : null;
};
const pointSize = (size: unknown) => {
  const value = parseFloat(String(size ?? ''));
  if (!value) return null;
  return String(size).endsWith('px') ? value * 0.75 : value;
};

const rtfEscape = (text: string) => {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\\' || char === '{' || char === '}') out += `\\${char}`;
    else if (char === '\t') out += '\\tab ';
    else if (char === '\n') out += '\\line ';
    else if (code < 128) out += char;
    else if (code <= 0xffff) out += `\\u${code > 32767 ? code - 65536 : code}?`;
    else {
      const units = char.split('');
      for (const unit of units) {
        const value = unit.charCodeAt(0);
        out += `\\u${value > 32767 ? value - 65536 : value}?`;
      }
    }
  }
  return out;
};

const RTF_IMAGE_KIND: Record<string, string> = { png: '\\pngblip', jpeg: '\\jpegblip', jpg: '\\jpegblip' };

const pngSize = (bytes: Uint8Array) => (bytes[0] === 0x89 && bytes.length > 24 ? { width: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19], height: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23] } : null);

const rtfImage = (node: JSONContent) => {
  const match = /^data:image\/(png|jpe?g);base64,(.*)$/s.exec(String(node.attrs?.src ?? ''));
  if (!match) return rtfEscape(`[${String(node.attrs?.alt || 'Ảnh')}]`);
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const natural = pngSize(bytes);
  const width = typeof node.attrs?.width === 'number' ? node.attrs.width : natural ? natural.width / 2 : 400;
  const height = typeof node.attrs?.height === 'number' ? node.attrs.height : natural ? (width * natural.height) / natural.width : Math.round(width * 0.6);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `{\\pict${RTF_IMAGE_KIND[match[1]]}\\picwgoal${Math.round(width * TWIP)}\\pichgoal${Math.round(height * TWIP)} ${hex}}`;
};

const rtfRegion = (page: PageSettings, zone: 'header' | 'footer', contentWidth: number) => {
  const zones = fieldZones(page, zone, '');
  if (!zones.some(Boolean)) return '';
  const part = (text: string) => text.split(/(\{pages?\})/).map((piece) => {
    if (piece === '{page}') return '{\\field{\\*\\fldinst PAGE}}';
    if (piece === '{pages}') return '{\\field{\\*\\fldinst NUMPAGES}}';
    return rtfEscape(piece);
  }).join('');
  const center = Math.round((contentWidth * TWIP) / 2);
  const right = Math.round(contentWidth * TWIP);
  return `{\\${zone}\\pard\\tqc\\tx${center}\\tqr\\tx${right}\\fs18 ${part(zones[0])}\\tab ${part(zones[1])}\\tab ${part(zones[2])}\\par}\n`;
};

export function exportRtf(json: JSONContent, page: PageSettings): Blob {
  const fonts: string[] = [page.fontFamily ?? 'Arial'];
  const colors: string[] = [];
  const fontIndex = (name: string) => {
    if (!fonts.includes(name)) fonts.push(name);
    return fonts.indexOf(name);
  };
  const colorIndex = (hex: string) => {
    if (!colors.includes(hex)) colors.push(hex);
    return colors.indexOf(hex) + 1;
  };
  const inline = (nodes: JSONContent[] = []): string => nodes.map((node) => {
    if (node.type === 'hardBreak') return '\\line ';
    if (node.type === 'footnote') return `{\\super\\chftn{\\footnote${node.attrs?.kind === 'end' ? '\\ftnalt' : ''}\\pard\\plain\\fs20{\\super\\chftn} ${rtfEscape(String(node.attrs?.text ?? ''))}}}`;
    if (node.type === 'image') return rtfImage(node);
    if (node.type !== 'text') return inline(node.content);
    const marks = (node.marks ?? []) as Mark[];
    let open = '';
    for (const mark of marks) {
      if (mark.type === 'bold') open += '\\b ';
      if (mark.type === 'italic') open += '\\i ';
      if (mark.type === 'underline') open += '\\ul ';
      if (mark.type === 'strike') open += '\\strike ';
      if (mark.type === 'superscript') open += '\\super ';
      if (mark.type === 'subscript') open += '\\sub ';
      if (mark.type === 'textStyle') {
        const color = toHex(mark.attrs?.color);
        if (color) open += `\\cf${colorIndex(color)} `;
        const size = pointSize(mark.attrs?.fontSize);
        if (size) open += `\\fs${Math.round(size * 2)} `;
        const font = String(mark.attrs?.fontFamily ?? '').split(',')[0].replaceAll(/["']/g, '').trim();
        if (font) open += `\\f${fontIndex(font)} `;
      }
    }
    const run = `{${open}${rtfEscape(node.text ?? '')}}`;
    const link = marks.find((mark) => mark.type === 'link');
    return link ? `{\\field{\\*\\fldinst HYPERLINK "${rtfEscape(String(link.attrs?.href ?? ''))}"}{\\fldrslt{\\ul\\cf${colorIndex('0563c1')} ${run}}}}` : run;
  }).join('');
  const paragraph = (node: JSONContent, prefix = '', extra = '') => {
    const align = { center: '\\qc', right: '\\qr', justify: '\\qj' }[String(node.attrs?.textAlign ?? '')] ?? '\\ql';
    const indent = Math.round((Number(node.attrs?.indent) || 0) * 720);
    return `{\\pard${align}${indent ? `\\li${indent}` : ''}${extra}\\sa120 ${prefix}${inline(node.content)}\\par}\n`;
  };
  const block = (node: JSONContent, depth = 0): string => {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(6, Number(node.attrs?.level) || 1);
        const size = [48, 36, 30, 26, 24, 24][level - 1];
        return `{\\pard\\keepn\\sb240\\sa120\\b\\fs${size} ${inline(node.content)}\\par}\n`;
      }
      case 'bulletList': return (node.content ?? []).map((item) => (item.content ?? []).map((child, i) => (i === 0 && child.type === 'paragraph' ? paragraph(child, `\\bullet\\tab `, `\\li${360 * (depth + 1)}\\fi-360`) : block(child, depth + 1))).join('')).join('');
      case 'orderedList': return (node.content ?? []).map((item, n) => (item.content ?? []).map((child, i) => (i === 0 && child.type === 'paragraph' ? paragraph(child, `${n + 1}.\\tab `, `\\li${360 * (depth + 1)}\\fi-360`) : block(child, depth + 1))).join('')).join('');
      case 'taskList': return (node.content ?? []).map((item) => paragraph(item.content?.[0] ?? {}, `${rtfEscape(item.attrs?.checked ? '☑ ' : '☐ ')}`)).join('');
      case 'pageBreak': return '\\page\n';
      case 'horizontalRule': return '{\\pard\\brdrb\\brdrs\\brdrw10\\sa120\\par}\n';
      case 'codeBlock': return nodeText(node).split('\n').map((line) => `{\\pard\\sa0\\f${fontIndex('Consolas')}\\fs20 ${rtfEscape(line)}\\par}\n`).join('');
      case 'table': {
        const rows = node.content ?? [];
        const count = Math.max(1, ...rows.map((row) => row.content?.length ?? 0));
        const size = PAGE_SIZES[page.size];
        const width = (page.orientation === 'landscape' ? size.height : size.width) - page.margins.left - page.margins.right;
        const cell = Math.round((width * TWIP) / count);
        return rows.map((row) => {
          const edges = Array.from({ length: row.content?.length ?? 0 }, (_, i) => `\\clbrdrt\\brdrs\\clbrdrb\\brdrs\\clbrdrl\\brdrs\\clbrdrr\\brdrs\\cellx${cell * (i + 1)}`).join('');
          const cells = (row.content ?? []).map((item) => `\\pard\\intbl ${(item.type === 'tableHeader' ? '\\b ' : '')}${rtfEscape(nodeText(item))}\\b0\\cell`).join(' ');
          return `{\\trowd\\trgaph108${edges} ${cells}\\row}\n`;
        }).join('');
      }
      case 'paragraph': return paragraph(node);
      default: return (node.content ?? []).map((child) => block(child, depth)).join('');
    }
  };
  const body = (json.content ?? []).map((node) => block(node)).join('');
  const size = PAGE_SIZES[page.size];
  const landscape = page.orientation === 'landscape';
  const fontTable = fonts.map((name, i) => `{\\f${i} ${rtfEscape(name)};}`).join('');
  const colorTable = `;${colors.map((hex) => `\\red${parseInt(hex.slice(0, 2), 16)}\\green${parseInt(hex.slice(2, 4), 16)}\\blue${parseInt(hex.slice(4, 6), 16)};`).join('')}`;
  const header = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl${fontTable}}{\\colortbl${colorTable}}\\ftnbj\\aenddoc\\fet2\\paperw${(landscape ? size.height : size.width) * TWIP}\\paperh${(landscape ? size.width : size.height) * TWIP}\\margl${page.margins.left * TWIP}\\margr${page.margins.right * TWIP}\\margt${page.margins.top * TWIP}\\margb${page.margins.bottom * TWIP}${landscape ? '\\landscape' : ''}\\fs${Math.round((page.fontSize ?? 12) * 2)}\n`;
  const width = (landscape ? size.height : size.width) - page.margins.left - page.margins.right;
  return new Blob([`${header}${rtfRegion(page, 'header', width)}${rtfRegion(page, 'footer', width)}${body}}`], { type: 'application/rtf' });
}

const dataUrlParts = (src: string) => {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(src);
  if (!match) return null;
  const extension = match[1].split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') ?? 'png';
  return { mime: match[1], extension, base64: Boolean(match[2]), data: match[3] };
};

const addDataFile = (zip: JSZip, path: string, parts: NonNullable<ReturnType<typeof dataUrlParts>>) => {
  if (parts.base64) zip.file(path, parts.data, { base64: true });
  else zip.file(path, decodeURIComponent(parts.data));
};

const odtRegion = (page: PageSettings, zone: 'header' | 'footer', title: string) => {
  const zones = fieldZones(page, zone, title);
  if (!zones.some(Boolean)) return '';
  const part = (text: string) => text.split(/(\{pages?\})/).map((piece) => {
    if (piece === '{page}') return '<text:page-number text:select-page="current">1</text:page-number>';
    if (piece === '{pages}') return '<text:page-count>1</text:page-count>';
    return escapeXml(piece);
  }).join('');
  return `<style:${zone}><text:p>${part(zones[0])}<text:tab/>${part(zones[1])}<text:tab/>${part(zones[2])}</text:p></style:${zone}>`;
};

export async function exportOdt(json: JSONContent, page: PageSettings, title: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  const styles = new Map<string, string>();
  const manifestImages: string[] = [];
  let imageCount = 0;
  let noteCount = 0;
  const textStyle = (marks: Mark[]) => {
    const props: string[] = [];
    for (const mark of marks) {
      if (mark.type === 'bold') props.push('fo:font-weight="bold"');
      if (mark.type === 'italic') props.push('fo:font-style="italic"');
      if (mark.type === 'underline') props.push('style:text-underline-style="solid" style:text-underline-width="auto"');
      if (mark.type === 'strike') props.push('style:text-line-through-style="solid"');
      if (mark.type === 'superscript') props.push('style:text-position="super 58%"');
      if (mark.type === 'subscript') props.push('style:text-position="sub 58%"');
      if (mark.type === 'highlight') props.push(`fo:background-color="#${toHex(mark.attrs?.color) ?? 'fff59d'}"`);
      if (mark.type === 'textStyle') {
        const color = toHex(mark.attrs?.color);
        if (color) props.push(`fo:color="#${color}"`);
        const size = pointSize(mark.attrs?.fontSize);
        if (size) props.push(`fo:font-size="${size}pt"`);
        const font = String(mark.attrs?.fontFamily ?? '').split(',')[0].replaceAll(/["']/g, '').trim();
        if (font) props.push(`style:font-name="${escapeXml(font)}" fo:font-family="${escapeXml(font)}"`);
      }
    }
    if (!props.length) return '';
    const key = `text:${props.join(' ')}`;
    if (!styles.has(key)) styles.set(key, `T${styles.size + 1}`);
    return styles.get(key) ?? '';
  };
  const paragraphStyle = (node: JSONContent) => {
    const props: string[] = [];
    const align = String(node.attrs?.textAlign ?? '');
    if (align) props.push(`fo:text-align="${align === 'left' ? 'start' : align === 'right' ? 'end' : align}"`);
    const indent = Number(node.attrs?.indent) || 0;
    if (indent) props.push(`fo:margin-left="${(indent * 1.27).toFixed(2)}cm"`);
    if (!props.length) return '';
    const key = `para:${props.join(' ')}`;
    if (!styles.has(key)) styles.set(key, `P${styles.size + 1}`);
    return styles.get(key) ?? '';
  };
  const inline = (nodes: JSONContent[] = []): string => nodes.map((node) => {
    if (node.type === 'hardBreak') return '<text:line-break/>';
    if (node.type === 'image') {
      const parts = dataUrlParts(String(node.attrs?.src ?? ''));
      if (!parts) return escapeXml(String(node.attrs?.alt ?? ''));
      imageCount++;
      const path = `Pictures/image${imageCount}.${parts.extension}`;
      addDataFile(zip, path, parts);
      manifestImages.push(`<manifest:file-entry manifest:full-path="${path}" manifest:media-type="${parts.mime}"/>`);
      const width = typeof node.attrs?.width === 'number' ? node.attrs.width : 400;
      const height = typeof node.attrs?.height === 'number' ? node.attrs.height : Math.round(width * 0.6);
      return `<draw:frame text:anchor-type="as-char" svg:width="${(width / 37.8).toFixed(2)}cm" svg:height="${(height / 37.8).toFixed(2)}cm"><draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
    }
    if (node.type === 'footnote') {
      noteCount += 1;
      return `<text:note text:id="note${noteCount}" text:note-class="${node.attrs?.kind === 'end' ? 'endnote' : 'footnote'}"><text:note-citation>${noteCount}</text:note-citation><text:note-body><text:p>${escapeXml(String(node.attrs?.text ?? ''))}</text:p></text:note-body></text:note>`;
    }
    if (node.type !== 'text') return inline(node.content);
    const marks = (node.marks ?? []) as Mark[];
    const body = escapeXml(node.text ?? '').replace(/\t/g, '<text:tab/>');
    const link = marks.find((mark) => mark.type === 'link');
    const name = textStyle(marks);
    const span = name ? `<text:span text:style-name="${name}">${body}</text:span>` : body;
    return link ? `<text:a xlink:type="simple" xlink:href="${escapeXml(String(link.attrs?.href ?? ''))}">${span}</text:a>` : span;
  }).join('');
  const block = (node: JSONContent): string => {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(6, Number(node.attrs?.level) || 1);
        return `<text:h text:style-name="Heading_20_${level}" text:outline-level="${level}">${inline(node.content)}</text:h>`;
      }
      case 'paragraph': {
        const name = paragraphStyle(node);
        return `<text:p${name ? ` text:style-name="${name}"` : ''}>${inline(node.content)}</text:p>`;
      }
      case 'bulletList':
      case 'orderedList':
        return `<text:list text:style-name="${node.type === 'orderedList' ? 'ListNumber' : 'ListBullet'}">${(node.content ?? []).map((item) => `<text:list-item>${(item.content ?? []).map(block).join('')}</text:list-item>`).join('')}</text:list>`;
      case 'taskList':
        return (node.content ?? []).map((item) => `<text:p>${item.attrs?.checked ? '☑' : '☐'} ${inline(item.content?.[0]?.content)}</text:p>`).join('');
      case 'blockquote': return (node.content ?? []).map(block).join('');
      case 'codeBlock': return nodeText(node).split('\n').map((line) => `<text:p text:style-name="Code">${escapeXml(line)}</text:p>`).join('');
      case 'horizontalRule': return '<text:p text:style-name="Rule"/>';
      case 'pageBreak': return '<text:p text:style-name="BreakAfter"/>';
      case 'table': {
        const rows = node.content ?? [];
        const count = Math.max(1, ...rows.map((row) => row.content?.length ?? 0));
        const columns = `<table:table-column table:number-columns-repeated="${count}"/>`;
        const body = rows.map((row) => `<table:table-row>${(row.content ?? []).map((cell) => `<table:table-cell table:style-name="Cell" office:value-type="string"${Number(cell.attrs?.colspan) > 1 ? ` table:number-columns-spanned="${cell.attrs?.colspan}"` : ''}>${(cell.content ?? []).map(block).join('') || '<text:p/>'}</table:table-cell>`).join('')}</table:table-row>`).join('');
        return `<table:table table:style-name="Tbl">${columns}${body}</table:table>`;
      }
      default: return (node.content ?? []).map(block).join('');
    }
  };
  const body = (json.content ?? []).map(block).join('');
  const automatic = [...styles.entries()].map(([key, name]) => {
    const [kind, props] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    return kind === 'text'
      ? `<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`
      : `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties ${props}/></style:style>`;
  }).join('');
  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"';
  const size = PAGE_SIZES[page.size];
  const landscape = page.orientation === 'landscape';
  const cm = (px: number) => `${(px / 37.8).toFixed(2)}cm`;
  const font = page.fontFamily ?? 'Arial';
  const headingStyles = [24, 18, 15, 13, 12, 12].map((pt, i) => `<style:style style:name="Heading_20_${i + 1}" style:display-name="Heading ${i + 1}" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="${i + 1}"><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="${pt}pt" fo:font-weight="bold"/></style:style>`).join('');
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}><office:automatic-styles>${automatic}<style:style style:name="Code" style:family="paragraph"><style:text-properties style:font-name="Consolas" fo:font-family="Consolas" fo:font-size="10pt"/></style:style><style:style style:name="Rule" style:family="paragraph"><style:paragraph-properties fo:border-bottom="0.5pt solid #c8ced8"/></style:style><style:style style:name="BreakAfter" style:family="paragraph"><style:paragraph-properties fo:break-after="page"/></style:style><style:style style:name="Tbl" style:family="table"><style:table-properties table:align="margins"/></style:style><style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #c8ced8"/></style:style><text:list-style style:name="ListBullet"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:space-before="0.6cm" text:min-label-width="0.6cm"/></text:list-level-style-bullet></text:list-style><text:list-style style:name="ListNumber"><text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix="."><style:list-level-properties text:space-before="0.6cm" text:min-label-width="0.6cm"/></text:list-level-style-number></text:list-style></office:automatic-styles><office:body><office:text>${body || '<text:p/>'}</office:text></office:body></office:document-content>`);
  zip.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS}><office:styles><style:default-style style:family="paragraph"><style:text-properties style:font-name="${escapeXml(font)}" fo:font-family="${escapeXml(font)}" fo:font-size="${page.fontSize ?? 12}pt" fo:language="vi" fo:country="VN"/></style:default-style><style:style style:name="Standard" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.2cm"/></style:style>${headingStyles}</office:styles><office:automatic-styles><style:page-layout style:name="PM"><style:page-layout-properties fo:page-width="${cm(landscape ? size.height : size.width)}" fo:page-height="${cm(landscape ? size.width : size.height)}" style:print-orientation="${page.orientation}" fo:margin-top="${cm(page.margins.top)}" fo:margin-bottom="${cm(page.margins.bottom)}" fo:margin-left="${cm(page.margins.left)}" fo:margin-right="${cm(page.margins.right)}"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="PM">${odtRegion(page, 'header', title)}${odtRegion(page, 'footer', title)}</style:master-page></office:master-styles></office:document-styles>`);
  zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS}><office:meta><dc:title>${escapeXml(title)}</dc:title><dc:creator>${escapeXml(page.properties?.author || 'Office 23')}</dc:creator>${page.properties?.subject ? `<dc:subject>${escapeXml(page.properties.subject)}</dc:subject>` : ''}<meta:generator>23 Docs</meta:generator></office:meta></office:document-meta>`);
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${manifestImages.join('')}</manifest:manifest>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text' });
}

export async function exportEpub(json: JSONContent, page: PageSettings, title: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const images: { id: string; href: string; mime: string }[] = [];
  const notes: string[] = [];
  const inline = (nodes: JSONContent[] = []): string => nodes.map((node) => {
    if (node.type === 'hardBreak') return '<br/>';
    if (node.type === 'image') {
      const parts = dataUrlParts(String(node.attrs?.src ?? ''));
      if (!parts) return '';
      const href = `images/i${images.length + 1}.${parts.extension}`;
      images.push({ id: `img${images.length + 1}`, href, mime: parts.mime });
      addDataFile(zip, `OEBPS/${href}`, parts);
      return `<img src="${href}" alt="${escapeXml(String(node.attrs?.alt ?? ''))}"/>`;
    }
    if (node.type === 'footnote') {
      notes.push(String(node.attrs?.text ?? ''));
      const id = notes.length;
      return `<sup><a epub:type="noteref" href="notes.xhtml#n${id}">${id}</a></sup>`;
    }
    if (node.type !== 'text') return inline(node.content);
    let text = escapeXml(node.text ?? '');
    for (const mark of (node.marks ?? []) as Mark[]) {
      if (mark.type === 'bold') text = `<strong>${text}</strong>`;
      if (mark.type === 'italic') text = `<em>${text}</em>`;
      if (mark.type === 'underline') text = `<u>${text}</u>`;
      if (mark.type === 'strike') text = `<s>${text}</s>`;
      if (mark.type === 'code') text = `<code>${text}</code>`;
      if (mark.type === 'link') text = `<a href="${escapeXml(String(mark.attrs?.href ?? ''))}">${text}</a>`;
    }
    return text;
  }).join('');
  const block = (node: JSONContent): string => {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(6, Number(node.attrs?.level) || 1);
        return `<h${level}>${inline(node.content)}</h${level}>`;
      }
      case 'paragraph': return `<p>${inline(node.content)}</p>`;
      case 'bulletList': return `<ul>${(node.content ?? []).map((item) => `<li>${(item.content ?? []).map(block).join('')}</li>`).join('')}</ul>`;
      case 'orderedList': return `<ol>${(node.content ?? []).map((item) => `<li>${(item.content ?? []).map(block).join('')}</li>`).join('')}</ol>`;
      case 'taskList': return `<ul>${(node.content ?? []).map((item) => `<li>${item.attrs?.checked ? '☑' : '☐'} ${inline(item.content?.[0]?.content)}</li>`).join('')}</ul>`;
      case 'blockquote': return `<blockquote>${(node.content ?? []).map(block).join('')}</blockquote>`;
      case 'codeBlock': return `<pre>${escapeXml(nodeText(node))}</pre>`;
      case 'horizontalRule': return '<hr/>';
      case 'pageBreak': return '';
      case 'table': return `<table>${(node.content ?? []).map((row) => `<tr>${(row.content ?? []).map((cell) => `<${cell.type === 'tableHeader' ? 'th' : 'td'}>${(cell.content ?? []).map(block).join('')}</${cell.type === 'tableHeader' ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</table>`;
      default: return (node.content ?? []).map(block).join('');
    }
  };
  const chapters: { title: string; body: string }[] = [];
  for (const node of json.content ?? []) {
    if (node.type === 'heading' && Number(node.attrs?.level) === 1) chapters.push({ title: nodeText(node).trim() || 'Chương', body: block(node) });
    else {
      if (!chapters.length) chapters.push({ title, body: '' });
      chapters[chapters.length - 1].body += block(node);
    }
  }
  if (!chapters.length) chapters.push({ title, body: '<p></p>' });
  chapters.forEach((chapter, index) => {
    zip.file(`OEBPS/c${index + 1}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" href="style.css"/></head><body>${chapter.body}</body></html>`);
  });
  if (notes.length) zip.file('OEBPS/notes.xhtml', `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi"><head><title>Chú thích</title><link rel="stylesheet" href="style.css"/></head><body><h1>Chú thích</h1>${notes.map((text, i) => `<aside epub:type="footnote" id="n${i + 1}"><p>${i + 1}. ${escapeXml(text)}</p></aside>`).join('')}</body></html>`);
  zip.file('OEBPS/style.css', `body{font-family:"${page.fontFamily ?? 'serif'}",serif;line-height:1.6}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 8px}img{max-width:100%}blockquote{margin:1em;color:#555}pre{white-space:pre-wrap;font-family:monospace}`);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi"><head><title>Mục lục</title></head><body><nav epub:type="toc"><h1>Mục lục</h1><ol>${chapters.map((c, i) => `<li><a href="c${i + 1}.xhtml">${escapeXml(c.title)}</a></li>`).join('')}</ol></nav></body></html>`);
  const id = `urn:uuid:${crypto.randomUUID()}`;
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">${id}</dc:identifier><dc:title>${escapeXml(title)}</dc:title><dc:language>${page.language ?? 'vi'}</dc:language><dc:creator>${escapeXml(page.properties?.author || 'Office 23')}</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${chapters.map((_, i) => `<item id="c${i + 1}" href="c${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}${notes.length ? '<item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/>' : ''}${images.map((img) => `<item id="${img.id}" href="${img.href}" media-type="${img.mime}"/>`).join('')}</manifest><spine>${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('')}${notes.length ? '<itemref idref="notes"/>' : ''}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
