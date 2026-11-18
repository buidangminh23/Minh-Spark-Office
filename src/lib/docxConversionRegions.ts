import type { JSONContent } from '@tiptap/react';
import type JSZip from 'jszip';

const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const strictRelationships = 'http://purl.oclc.org/ooxml/officeDocument/relationships';
const parse = (source: string) => new DOMParser().parseFromString(source, 'application/xml');

function regionParagraphs(root: Element): JSONContent[] {
  const output: JSONContent[] = [];
  const stack: { element: Element; paragraph?: JSONContent }[] = [{ element: root }];
  while (stack.length) {
    const entry = stack.pop()!;
    const element = entry.element;
    let paragraph = entry.paragraph;
    const tag = element.localName;
    if (element.namespaceURI === root.namespaceURI) {
      if (tag === 'del' || tag === 'moveFrom' || tag === 'instrText') continue;
      if (tag === 'p') {
        paragraph = { type: 'paragraph', content: [] };
        output.push(paragraph);
      } else if (tag === 'br' || tag === 'cr') {
        paragraph?.content?.push({ type: 'hardBreak' });
      } else if (tag === 't' || tag === 'tab') {
        const text = tag === 'tab' ? '\t' : element.textContent;
        if (text) paragraph?.content?.push({ type: 'text', text });
      }
    }
    const children = Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1);
    if (tag === 'AlternateContent') {
      const choice = children.find(child => child.localName === 'Choice') ?? children.find(child => child.localName === 'Fallback');
      if (choice) stack.push({ element: choice, paragraph });
    } else {
      for (let index = children.length - 1; index >= 0; index--) stack.push({ element: children[index], paragraph });
    }
  }
  return output.filter(node => node.content?.some(child => child.text?.trim()));
}

export async function includeDocxConversionRegions(zip: JSZip, body: JSONContent): Promise<JSONContent> {
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
  if (!relsXml) return body;
  const parts = new Map<string, { path: string; kind: string }>();
  for (const rel of Array.from(parse(relsXml).getElementsByTagNameNS('*', 'Relationship'))) {
    const kind = rel.getAttribute('Type')?.split('/').pop();
    const target = rel.getAttribute('Target');
    if ((kind !== 'header' && kind !== 'footer') || !target || rel.getAttribute('TargetMode')?.toLowerCase() === 'external' || /^([a-z][\w+.\-]*:|\/\/)/i.test(target) || target.includes('\\')) continue;
    const path = new URL(target, 'https://package.local/word/document.xml').pathname.slice(1);
    parts.set(rel.getAttribute('Id') ?? '', { path, kind });
  }
  if (!parts.size) return body;
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) return body;
  const document = parse(documentXml);
  const wordNamespace = document.documentElement.namespaceURI;
  const headers: JSONContent[] = [], footers: JSONContent[] = [];
  const seen = new Set<string>();
  for (const section of Array.from(document.getElementsByTagNameNS(wordNamespace, 'sectPr'))) {
    if (section.parentNode && (section.parentNode as Element).localName === 'sectPrChange') continue;
    for (const ref of Array.from(section.childNodes)) {
      if (ref.nodeType !== 1) continue;
      const element = ref as Element;
      const id = element.getAttributeNS(relationships, 'id') || element.getAttributeNS(strictRelationships, 'id');
      const part = id && parts.get(id);
      if (!part || element.localName !== part.kind + 'Reference' || seen.has(part.path)) continue;
      seen.add(part.path);
      const contents = await zip.file(part.path)?.async('string');
      if (!contents) continue;
      const root = parse(contents).documentElement;
      if (root.localName !== (part.kind === 'header' ? 'hdr' : 'ftr')) continue;
      const paragraphs = regionParagraphs(root);
      const destination = part.kind === 'header' ? headers : footers;
      for (const paragraph of paragraphs) destination.push(paragraph);
    }
  }
  return { ...body, content: [...headers, ...(body.content ?? []), ...footers] };
}
