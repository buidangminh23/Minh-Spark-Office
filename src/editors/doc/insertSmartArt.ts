export type SmartArtLayout = 'list' | 'vlist' | 'process' | 'cycle' | 'hierarchy' | 'relationship' | 'matrix' | 'pyramid';
export type SmartArtSpec = { layout: SmartArtLayout; text: string; palette: string };
type Item = { text: string; children: Item[] };

export const SMARTART_LAYOUTS: { id: SmartArtLayout; label: string; sample: string }[] = [
  { id: 'list', label: 'Danh sách ngang', sample: 'Mục tiêu\n  Tăng doanh thu\n  Mở rộng thị trường\nNguồn lực\n  Nhân sự\n  Ngân sách\nKết quả\n  Báo cáo quý' },
  { id: 'vlist', label: 'Danh sách dọc', sample: 'Giai đoạn 1\n  Khảo sát hiện trạng\nGiai đoạn 2\n  Triển khai thử\nGiai đoạn 3\n  Nhân rộng' },
  { id: 'process', label: 'Quy trình', sample: 'Tiếp nhận\nKiểm tra\nPhê duyệt\nThực hiện\nBáo cáo' },
  { id: 'cycle', label: 'Chu kỳ', sample: 'Lập kế hoạch\nThực hiện\nKiểm tra\nCải tiến' },
  { id: 'hierarchy', label: 'Phân cấp', sample: 'Giám đốc\n  Phó giám đốc kỹ thuật\n    Phòng kỹ thuật\n    Phòng dự án\n  Phó giám đốc kinh doanh\n    Phòng kinh doanh' },
  { id: 'relationship', label: 'Quan hệ', sample: 'Khách hàng\nSản phẩm\nĐối tác' },
  { id: 'matrix', label: 'Ma trận', sample: 'Điểm mạnh\nĐiểm yếu\nCơ hội\nThách thức' },
  { id: 'pyramid', label: 'Kim tự tháp', sample: 'Tầm nhìn\nChiến lược\nKế hoạch\nHành động' },
];

export const SMARTART_PALETTES: { id: string; label: string; colors: string[] }[] = [
  { id: 'blue', label: 'Xanh dương', colors: ['#2b579a', '#3f73c2', '#5b8def', '#7ea6f4'] },
  { id: 'green', label: 'Xanh lục', colors: ['#107c41', '#2e9960', '#4cb07a', '#6fc596'] },
  { id: 'orange', label: 'Cam', colors: ['#c2410c', '#ea580c', '#f97316', '#fb923c'] },
  { id: 'purple', label: 'Tím', colors: ['#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa'] },
  { id: 'gray', label: 'Xám', colors: ['#334155', '#475569', '#64748b', '#94a3b8'] },
  { id: 'colorful', label: 'Nhiều màu', colors: ['#2b579a', '#d97706', '#107c41', '#b91c1c', '#7c3aed'] },
];

const FONT = 'font-family="Arial, sans-serif"';
const escapeXml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export function parseItems(text: string) {
  const root: Item = { text: '', children: [] };
  const stack: { level: number; item: Item }[] = [{ level: -1, item: root }];
  for (const raw of text.split('\n')) {
    const label = raw.trim().replace(/^[-•*]\s*/, '');
    if (!label) continue;
    const indent = raw.match(/^[\t ]*/)?.[0].replace(/\t/g, '  ').length ?? 0;
    const level = Math.floor(indent / 2);
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    const item: Item = { text: label, children: [] };
    stack[stack.length - 1].item.children.push(item);
    stack.push({ level, item });
  }
  return root.children;
}

const wrap = (text: string, maxChars: number) => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current && `${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
};

const label = (x: number, y: number, text: string, width: number, size = 14, color = '#ffffff', weight = 600) => {
  const lines = wrap(text, Math.max(4, Math.floor(width / (size * 0.56))));
  const start = y - ((lines.length - 1) * size * 1.25) / 2;
  return `<text x="${x}" text-anchor="middle" dominant-baseline="central" ${FONT} font-size="${size}" font-weight="${weight}" fill="${color}">${lines.map((line, i) => `<tspan x="${x}" y="${start + i * size * 1.25}">${escapeXml(line)}</tspan>`).join('')}</text>`;
};

const pick = (colors: string[], index: number) => colors[index % colors.length];

const listLayout = (items: Item[], colors: string[]) => {
  const gap = 16;
  const count = Math.max(1, items.length);
  const width = (800 - gap * (count - 1)) / count;
  const rows = Math.max(1, ...items.map((item) => item.children.length));
  const height = 60 + rows * 34 + 18;
  const body = items.map((item, i) => {
    const x = i * (width + gap);
    const color = pick(colors, i);
    return `<rect x="${x}" y="1" width="${width}" height="${height - 2}" rx="8" fill="#f8fafc" stroke="${color}" stroke-width="2"/><rect x="${x}" y="1" width="${width}" height="56" rx="8" fill="${color}"/>${label(x + width / 2, 29, item.text, width - 16)}${item.children.map((child, j) => label(x + width / 2, 80 + j * 34, child.text, width - 16, 12, '#1f2430', 400)).join('')}`;
  }).join('');
  return { w: 800, h: height, body };
};

const verticalList = (items: Item[], colors: string[]) => {
  let y = 1;
  const body = items.map((item, i) => {
    const color = pick(colors, i);
    const details = item.children.map((child) => child.text).join(' · ');
    const part = `<rect x="1" y="${y}" width="220" height="60" rx="8" fill="${color}"/>${label(111, y + 30, item.text, 200)}<rect x="221" y="${y + 8}" width="578" height="44" fill="#f1f5f9" stroke="${color}"/>${details ? label(510, y + 30, details, 560, 12, '#1f2430', 400) : ''}`;
    y += 72;
    return part;
  }).join('');
  return { w: 800, h: Math.max(80, y), body };
};

const processLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const width = 800 / count;
  const body = items.map((item, i) => {
    const x = i * width;
    const tip = Math.min(24, width / 4);
    const notch = i ? tip : 0;
    return `<polygon points="${x + 1},2 ${x + width - tip - 2},2 ${x + width - 2},60 ${x + width - tip - 2},118 ${x + 1},118 ${x + 1 + notch},60" fill="${pick(colors, i)}"/>${label(x + width / 2 + notch / 4, 60, item.text, width - tip - notch - 8, 13)}${item.children.map((child, j) => label(x + width / 2, 142 + j * 26, child.text, width - 16, 12, '#1f2430', 400)).join('')}`;
  }).join('');
  const rows = Math.max(0, ...items.map((item) => item.children.length));
  return { w: 800, h: 124 + rows * 26 + (rows ? 8 : 0), body };
};

const ARROW = (color: string) => `<defs><marker id="sa" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${color}"/></marker></defs>`;

const cycleLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const radius = 170;
  const cx = 300;
  const cy = 240;
  const nodeR = count > 6 ? 48 : 62;
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a), a };
  };
  const inset = Math.asin(Math.min(0.95, (nodeR + 10) / (2 * radius))) * 2;
  const arcs = items.map((_, i) => {
    const start = at(i).a + inset;
    const end = at(i).a + (Math.PI * 2) / count - inset;
    if (end <= start) return '';
    return `<path d="M${cx + radius * Math.cos(start)} ${cy + radius * Math.sin(start)} A${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(end)} ${cy + radius * Math.sin(end)}" fill="none" stroke="#94a3b8" stroke-width="4" marker-end="url(#sa)"/>`;
  }).join('');
  const nodes = items.map((item, i) => {
    const p = at(i);
    return `<circle cx="${p.x}" cy="${p.y}" r="${nodeR}" fill="${pick(colors, i)}"/>${label(p.x, p.y, item.text, nodeR * 1.6, 13)}`;
  }).join('');
  return { w: 600, h: 480, body: `${ARROW('#94a3b8')}${arcs}${nodes}` };
};

const hierarchyLayout = (items: Item[], colors: string[]) => {
  const nodeW = 140;
  const nodeH = 52;
  const gapX = 16;
  const gapY = 44;
  let cursor = 0;
  let maxDepth = 0;
  type Placed = { x: number; y: number; item: Item; depth: number; kids: Placed[] };
  const place = (item: Item, depth: number): Placed => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = item.children.map((child) => place(child, depth + 1));
    let x: number;
    if (kids.length) x = (kids[0].x + kids[kids.length - 1].x) / 2;
    else {
      x = cursor;
      cursor += nodeW + gapX;
    }
    return { x, y: depth * (nodeH + gapY), item, depth, kids };
  };
  const roots = items.map((item) => place(item, 0));
  const parts: string[] = [];
  const draw = (node: Placed) => {
    for (const kid of node.kids) {
      const midY = node.y + nodeH + gapY / 2;
      parts.push(`<path d="M${node.x + nodeW / 2} ${node.y + nodeH} V${midY} H${kid.x + nodeW / 2} V${kid.y}" fill="none" stroke="#94a3b8" stroke-width="2"/>`);
      draw(kid);
    }
    parts.push(`<rect x="${node.x}" y="${node.y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${pick(colors, node.depth)}"/>${label(node.x + nodeW / 2, node.y + nodeH / 2, node.item.text, nodeW - 12, 12)}`);
  };
  roots.forEach(draw);
  return { w: Math.max(nodeW, cursor - gapX), h: (maxDepth + 1) * nodeH + maxDepth * gapY, body: parts.join('') };
};

const relationshipLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, Math.min(items.length, 5));
  const r = 120;
  const spread = count === 1 ? 0 : count === 2 ? 80 : 90;
  const cx = 300;
  const cy = 200;
  const body = items.slice(0, 5).map((item, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    const x = cx + spread * Math.cos(a);
    const y = cy + spread * Math.sin(a);
    const tx = cx + (spread + 44) * Math.cos(a);
    const ty = cy + (spread + 44) * Math.sin(a);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${pick(colors, i)}" fill-opacity="0.62" stroke="#ffffff" stroke-width="2"/>${label(tx, ty, item.text, 130, 14)}`;
  }).join('');
  return { w: 600, h: 440, body };
};

const matrixLayout = (items: Item[], colors: string[]) => {
  const cols = 2;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const size = { w: 300, h: 130 };
  const body = items.map((item, i) => {
    const x = (i % cols) * (size.w + 8);
    const y = Math.floor(i / cols) * (size.h + 8);
    return `<rect x="${x}" y="${y}" width="${size.w}" height="${size.h}" rx="6" fill="${pick(colors, i)}"/>${label(x + size.w / 2, y + size.h / 2 - (item.children.length ? 16 : 0), item.text, size.w - 24, 15)}${item.children.length ? label(x + size.w / 2, y + size.h / 2 + 24, item.children.map((c) => c.text).join(' · '), size.w - 24, 12, '#ffffff', 400) : ''}`;
  }).join('');
  return { w: cols * size.w + 8, h: rows * size.h + (rows - 1) * 8, body };
};

const pyramidLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const width = 640;
  const levelH = 76;
  const total = count * levelH;
  const body = items.map((item, i) => {
    const top = i * levelH;
    const halfTop = (width / 2) * (i / count);
    const halfBottom = (width / 2) * ((i + 1) / count);
    const cx = width / 2;
    return `<polygon points="${cx - halfTop},${top} ${cx + halfTop},${top} ${cx + halfBottom},${top + levelH - 3} ${cx - halfBottom},${top + levelH - 3}" fill="${pick(colors, i)}"/>${label(cx, top + levelH / 2 + (i === 0 ? 14 : 0), item.text, Math.max(70, halfBottom * 1.6), 14)}`;
  }).join('');
  return { w: width, h: total, body };
};

const LAYOUT_BUILDERS: Record<SmartArtLayout, (items: Item[], colors: string[]) => { w: number; h: number; body: string }> = {
  list: listLayout, vlist: verticalList, process: processLayout, cycle: cycleLayout, hierarchy: hierarchyLayout, relationship: relationshipLayout, matrix: matrixLayout, pyramid: pyramidLayout,
};

export function smartArtDataUrl(spec: SmartArtSpec) {
  const colors = (SMARTART_PALETTES.find((item) => item.id === spec.palette) ?? SMARTART_PALETTES[0]).colors;
  const items = parseItems(spec.text);
  const { w, h, body } = LAYOUT_BUILDERS[spec.layout](items, colors);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w) + 2}" height="${Math.ceil(h) + 2}" viewBox="-1 -1 ${Math.ceil(w) + 2} ${Math.ceil(h) + 2}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
