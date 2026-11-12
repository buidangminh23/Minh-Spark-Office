export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXmlEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(source)) !== null) {
    const current = stack[stack.length - 1];
    if (match[1] !== undefined) {
      current.text += match[1];
    } else if (match[3] !== undefined) {
      if (match[2] === '/') {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const node: XmlNode = { name: match[3], attrs: {}, children: [], text: '' };
      if (match[4]) {
        ATTRIBUTE.lastIndex = 0;
        let attribute: RegExpExecArray | null;
        while ((attribute = ATTRIBUTE.exec(match[4])) !== null) {
          node.attrs[attribute[1]] = decodeXmlEntities(attribute[2] ?? attribute[3] ?? '');
        }
      }
      current.children.push(node);
      if (match[5] !== '/') stack.push(node);
    } else if (match[6] !== undefined) {
      current.text += decodeXmlEntities(match[6]);
    }
  }
  return root;
}

export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((item) => item.name === name);
}

export function childrenOf(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.filter((item) => item.name === name) : [];
}

export function path(node: XmlNode | undefined, ...names: string[]): XmlNode | undefined {
  let current = node;
  for (const name of names) {
    current = child(current, name);
    if (!current) return undefined;
  }
  return current;
}

export function descendants(node: XmlNode | undefined, name: string, out: XmlNode[] = []): XmlNode[] {
  if (!node) return out;
  for (const item of node.children) {
    if (item.name === name) out.push(item);
    descendants(item, name, out);
  }
  return out;
}

export function localName(name: string): string {
  const index = name.indexOf(':');
  return index < 0 ? name : name.slice(index + 1);
}
