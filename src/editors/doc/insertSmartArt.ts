export type SmartArtLayout = 'list' | 'vlist' | 'process' | 'cycle' | 'hierarchy' | 'relationship' | 'matrix' | 'pyramid'
  | 'timeline' | 'chevron' | 'bending' | 'steps' | 'funnel' | 'target' | 'radial' | 'compare' | 'grid' | 'growth' | 'gear' | 'balance' | 'circles' | 'stacked';
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
  { id: 'timeline', label: 'Dòng thời gian', sample: 'Quý I\n  Khởi động dự án\nQuý II\n  Thiết kế\nQuý III\n  Thi công\nQuý IV\n  Nghiệm thu' },
  { id: 'chevron', label: 'Danh sách mũi tên', sample: 'Bước 1\n  Thu thập yêu cầu\nBước 2\n  Phân tích và thiết kế\nBước 3\n  Triển khai\nBước 4\n  Đánh giá kết quả' },
  { id: 'bending', label: 'Quy trình uốn khúc', sample: 'Đăng ký\nXét duyệt hồ sơ\nPhỏng vấn\nKý hợp đồng\nĐào tạo\nBắt đầu làm việc' },
  { id: 'steps', label: 'Bậc thang', sample: 'Khởi đầu\n  Học cơ bản\nPhát triển\n  Thực hành\nThành thạo\n  Dự án thật\nChuyên gia\n  Hướng dẫn người khác' },
  { id: 'funnel', label: 'Phễu', sample: 'Tiếp cận\n  10.000 người\nQuan tâm\n  2.000 người\nCân nhắc\n  500 người\nMua hàng\n  120 người' },
  { id: 'target', label: 'Mục tiêu đồng tâm', sample: 'Thị trường tổng\nThị trường mục tiêu\nKhách hàng tiềm năng\nKhách hàng trung thành' },
  { id: 'radial', label: 'Toả tròn', sample: 'Dự án\n  Nhân sự\n  Ngân sách\n  Tiến độ\n  Chất lượng\n  Rủi ro\n  Truyền thông' },
  { id: 'compare', label: 'So sánh hai bên', sample: 'Phương án A\n  Chi phí thấp\n  Triển khai nhanh\n  Ít tuỳ biến\nPhương án B\n  Chi phí cao hơn\n  Linh hoạt\n  Dễ mở rộng' },
  { id: 'grid', label: 'Lưới khối', sample: 'Kế hoạch\n  Mục tiêu rõ ràng\nThiết kế\n  Bản vẽ\nThi công\n  Đúng tiến độ\nGiám sát\n  Chất lượng\nNghiệm thu\n  Hồ sơ\nBàn giao\n  Bảo hành' },
  { id: 'growth', label: 'Tăng trưởng', sample: 'Khởi nghiệp\nTìm khách hàng\nMở rộng\nDẫn đầu thị trường' },
  { id: 'gear', label: 'Bánh răng', sample: 'Con người\nQuy trình\nCông nghệ' },
  { id: 'balance', label: 'Cán cân', sample: 'Lợi ích\n  Tiết kiệm thời gian\n  Giảm sai sót\nChi phí\n  Đầu tư ban đầu\n  Đào tạo' },
  { id: 'circles', label: 'Quy trình vòng tròn', sample: 'Ý tưởng\nThiết kế\nThử nghiệm\nRa mắt' },
  { id: 'stacked', label: 'Các lớp xếp chồng', sample: 'Giao diện\nỨng dụng\nDịch vụ\nDữ liệu\nHạ tầng' },
];

export const SMARTART_PALETTES: { id: string; label: string; colors: string[] }[] = [
  { id: 'blue', label: 'Xanh dương', colors: ['#2b579a', '#3f73c2', '#5b8def', '#7ea6f4'] },
  { id: 'green', label: 'Xanh lục', colors: ['#107c41', '#2e9960', '#4cb07a', '#6fc596'] },
  { id: 'orange', label: 'Cam', colors: ['#c2410c', '#ea580c', '#f97316', '#fb923c'] },
  { id: 'purple', label: 'Tím', colors: ['#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa'] },
  { id: 'gray', label: 'Xám', colors: ['#334155', '#475569', '#64748b', '#94a3b8'] },
  { id: 'colorful', label: 'Nhiều màu', colors: ['#2b579a', '#d97706', '#107c41', '#b91c1c', '#7c3aed'] },
  { id: 'office', label: 'Office', colors: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'] },
  { id: 'red', label: 'Đỏ', colors: ['#991b1b', '#b91c1c', '#dc2626', '#ef4444'] },
  { id: 'teal', label: 'Xanh ngọc', colors: ['#115e59', '#0f766e', '#0d9488', '#14b8a6'] },
  { id: 'pink', label: 'Hồng', colors: ['#9d174d', '#be185d', '#db2777', '#ec4899'] },
  { id: 'navy', label: 'Xanh đậm', colors: ['#0f172a', '#1e293b', '#1e3a8a', '#1d4ed8'] },
  { id: 'warm', label: 'Ấm', colors: ['#b45309', '#d97706', '#dc2626', '#9a3412', '#ca8a04'] },
  { id: 'pastel', label: 'Pastel', colors: ['#6d8fd6', '#5fb3a1', '#e0a050', '#d47a8f', '#9d86d0'] },
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

const timelineLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const step = count > 1 ? 620 / (count - 1) : 0;
  const axis = 160;
  const body = items.map((item, i) => {
    const x = count > 1 ? 90 + i * step : 400;
    const up = i % 2 === 0;
    const boxY = up ? axis - 118 : axis + 34;
    const width = Math.min(170, Math.max(110, step * 1.7));
    const color = pick(colors, i);
    const details = item.children.map((child) => child.text).join(' · ');
    return `<line x1="${x}" y1="${up ? boxY + 84 : axis + 14}" x2="${x}" y2="${up ? axis - 14 : boxY}" stroke="${color}" stroke-width="2"/><circle cx="${x}" cy="${axis}" r="14" fill="${color}" stroke="#ffffff" stroke-width="3"/><rect x="${x - width / 2}" y="${boxY}" width="${width}" height="84" rx="8" fill="#ffffff" stroke="${color}" stroke-width="2"/><rect x="${x - width / 2}" y="${boxY}" width="${width}" height="34" rx="8" fill="${color}"/>${label(x, boxY + 17, item.text, width - 12, 13)}${details ? label(x, boxY + 58, details, width - 12, 11, '#1f2430', 400) : ''}`;
  }).join('');
  return { w: 800, h: 320, body: `<rect x="0" y="${axis - 4}" width="800" height="8" rx="4" fill="#cbd5e1"/>${body}` };
};

const chevronList = (items: Item[], colors: string[]) => {
  let y = 1;
  const body = items.map((item, i) => {
    const color = pick(colors, i);
    const details = item.children.map((child) => child.text).join(' · ');
    const part = `<polygon points="1,${y} 170,${y} 200,${y + 32} 170,${y + 64} 1,${y + 64} 31,${y + 32}" fill="${color}"/>${label(104, y + 32, item.text, 130, 13)}<rect x="210" y="${y + 6}" width="589" height="52" rx="6" fill="#f8fafc" stroke="${color}"/>${details ? label(505, y + 32, details, 570, 12, '#1f2430', 400) : ''}`;
    y += 74;
    return part;
  }).join('');
  return { w: 800, h: Math.max(80, y), body };
};

const bendingLayout = (items: Item[], colors: string[]) => {
  const perRow = 3;
  const boxW = 200;
  const boxH = 84;
  const gapX = 70;
  const gapY = 56;
  const at = (i: number) => {
    const row = Math.floor(i / perRow);
    const col = row % 2 ? perRow - 1 - (i % perRow) : i % perRow;
    return { x: col * (boxW + gapX), y: row * (boxH + gapY) };
  };
  const links = items.slice(1).map((_, k) => {
    const a = at(k);
    const b = at(k + 1);
    if (a.y === b.y) {
      const right = b.x > a.x;
      const x1 = right ? a.x + boxW + 6 : a.x - 6;
      const x2 = right ? b.x - 10 : b.x + boxW + 10;
      return `<line x1="${x1}" y1="${a.y + boxH / 2}" x2="${x2}" y2="${b.y + boxH / 2}" stroke="#94a3b8" stroke-width="4" marker-end="url(#sa)"/>`;
    }
    return `<line x1="${a.x + boxW / 2}" y1="${a.y + boxH + 6}" x2="${b.x + boxW / 2}" y2="${b.y - 10}" stroke="#94a3b8" stroke-width="4" marker-end="url(#sa)"/>`;
  }).join('');
  const boxes = items.map((item, i) => {
    const { x, y } = at(i);
    return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="10" fill="${pick(colors, i)}"/>${label(x + boxW / 2, y + boxH / 2 - (item.children.length ? 12 : 0), item.text, boxW - 20, 14)}${item.children.length ? label(x + boxW / 2, y + boxH / 2 + 18, item.children.map((c) => c.text).join(' · '), boxW - 20, 11, '#ffffff', 400) : ''}`;
  }).join('');
  const rows = Math.max(1, Math.ceil(items.length / perRow));
  return { w: perRow * boxW + (perRow - 1) * gapX, h: rows * boxH + (rows - 1) * gapY, body: `${ARROW('#94a3b8')}${links}${boxes}` };
};

const stepsLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const width = 800 / count;
  const rise = Math.min(60, 260 / count);
  const base = 110;
  const height = base + rise * (count - 1);
  const body = items.map((item, i) => {
    const h = base + rise * i;
    const x = i * width;
    const y = height - h;
    return `<rect x="${x + 1}" y="${y}" width="${width - 2}" height="${h}" rx="4" fill="${pick(colors, i)}"/>${label(x + width / 2, y + 28, item.text, width - 14, 14)}${item.children.map((child, j) => label(x + width / 2, y + 60 + j * 22, child.text, width - 14, 11, '#ffffff', 400)).join('')}`;
  }).join('');
  return { w: 800, h: height, body };
};

const funnelLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const levelH = 64;
  const top = 640;
  const bottom = 180;
  const cx = top / 2;
  const half = (i: number) => (top - ((top - bottom) * i) / count) / 2;
  const body = items.map((item, i) => {
    const y = i * (levelH + 6);
    return `<polygon points="${cx - half(i)},${y} ${cx + half(i)},${y} ${cx + half(i + 1)},${y + levelH} ${cx - half(i + 1)},${y + levelH}" fill="${pick(colors, i)}"/>${label(cx, y + levelH / 2, item.children.length ? `${item.text}: ${item.children.map((c) => c.text).join(', ')}` : item.text, half(i + 1) * 1.7, 14)}`;
  }).join('');
  return { w: top, h: count * (levelH + 6) - 6, body };
};

const targetLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const cx = 210;
  const cy = 210;
  const outer = 200;
  const rings = items.map((_, i) => `<circle cx="${cx}" cy="${cy}" r="${outer - (i * outer) / count}" fill="${pick(colors, i)}" stroke="#ffffff" stroke-width="3"/>`).join('');
  const notes = items.map((item, i) => {
    const r = outer - ((i + 0.5) * outer) / count;
    const ty = 30 + (i * 360) / Math.max(1, count - 1 || 1);
    const ly = count === 1 ? cy : ty;
    const elbow = cx + outer + 24;
    const angle = Math.atan2(ly - cy, elbow - cx);
    const ax = cx + r * Math.cos(angle);
    const ay = cy + r * Math.sin(angle);
    return `<path d="M${ax} ${ay} L${elbow} ${ly} H450" fill="none" stroke="#64748b" stroke-width="1.5"/><circle cx="${ax}" cy="${ay}" r="4" fill="#1f2430"/>${label(600, ly, item.children.length ? `${item.text}: ${item.children.map((c) => c.text).join(', ')}` : item.text, 290, 14, '#1f2430', 600)}`;
  }).join('');
  return { w: 760, h: 420, body: `${rings}${notes}` };
};

const radialLayout = (items: Item[], colors: string[]) => {
  const center = items[0];
  const around = center && center.children.length ? center.children : items.slice(1);
  const count = Math.max(1, around.length);
  const cx = 300;
  const cy = 240;
  const radius = 175;
  const nodeR = count > 8 ? 46 : 58;
  const spokes = around.map((_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    return `<line x1="${cx}" y1="${cy}" x2="${cx + radius * Math.cos(a)}" y2="${cy + radius * Math.sin(a)}" stroke="#94a3b8" stroke-width="3"/>`;
  }).join('');
  const nodes = around.map((item, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    return `<circle cx="${x}" cy="${y}" r="${nodeR}" fill="${pick(colors, i + 1)}"/>${label(x, y, item.text, nodeR * 1.6, 12)}`;
  }).join('');
  const hub = center ? `<circle cx="${cx}" cy="${cy}" r="78" fill="${pick(colors, 0)}" stroke="#ffffff" stroke-width="4"/>${label(cx, cy, center.text, 130, 16)}` : '';
  return { w: 600, h: 480, body: `${spokes}${hub}${nodes}` };
};

const compareLayout = (items: Item[], colors: string[]) => {
  const sides = items.slice(0, 2);
  const rows = Math.max(1, ...sides.map((item) => item.children.length));
  const colW = 360;
  const height = 70 + rows * 40 + 20;
  const body = sides.map((item, i) => {
    const x = i ? 440 : 0;
    const color = pick(colors, i * 2);
    return `<rect x="${x}" y="1" width="${colW}" height="${height - 2}" rx="10" fill="#f8fafc" stroke="${color}" stroke-width="2"/><rect x="${x}" y="1" width="${colW}" height="58" rx="10" fill="${color}"/>${label(x + colW / 2, 30, item.text, colW - 24, 16)}${item.children.map((child, j) => `<circle cx="${x + 26}" cy="${86 + j * 40}" r="5" fill="${color}"/><text x="${x + 42}" y="${86 + j * 40}" dominant-baseline="central" ${FONT} font-size="13" fill="#1f2430">${escapeXml(child.text)}</text>`).join('')}`;
  }).join('');
  return { w: 800, h: height, body: `${body}<circle cx="400" cy="${height / 2}" r="34" fill="#1f2430"/>${label(400, height / 2, 'VS', 60, 18)}` };
};

const gridLayout = (items: Item[], colors: string[]) => {
  const cols = 3;
  const size = { w: 256, h: 120 };
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const body = items.map((item, i) => {
    const x = (i % cols) * (size.w + 16);
    const y = Math.floor(i / cols) * (size.h + 16);
    const color = pick(colors, i);
    return `<rect x="${x}" y="${y}" width="${size.w}" height="${size.h}" rx="10" fill="${color}"/><rect x="${x + 12}" y="${y + 12}" width="8" height="${size.h - 24}" rx="4" fill="#ffffff" fill-opacity="0.45"/>${label(x + size.w / 2 + 6, y + size.h / 2 - (item.children.length ? 14 : 0), item.text, size.w - 44, 15)}${item.children.length ? label(x + size.w / 2 + 6, y + size.h / 2 + 22, item.children.map((c) => c.text).join(' · '), size.w - 44, 11, '#ffffff', 400) : ''}`;
  }).join('');
  return { w: cols * size.w + (cols - 1) * 16, h: rows * size.h + (rows - 1) * 16, body };
};

const growthLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const arrow = `<path d="M20 330 Q360 330 690 60 L660 46 L760 20 L736 120 L716 88 Q380 380 20 370 Z" fill="#e2e8f0"/>`;
  const nodes = items.map((item, i) => {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const x = 90 + t * 560;
    const y = 330 - t * t * 230 - 20;
    const color = pick(colors, i);
    return `<circle cx="${x}" cy="${y}" r="26" fill="${color}" stroke="#ffffff" stroke-width="4"/>${label(x, y, String(i + 1), 30, 16)}${label(x, y - 52, item.text, 150, 13, '#1f2430', 600)}`;
  }).join('');
  return { w: 780, h: 390, body: `${arrow}${nodes}` };
};

const gearLayout = (items: Item[], colors: string[]) => {
  const placed = [{ x: 170, y: 190, r: 120 }, { x: 370, y: 110, r: 90 }, { x: 380, y: 300, r: 80 }, { x: 540, y: 220, r: 70 }, { x: 560, y: 380, r: 56 }];
  const gear = (cx: number, cy: number, r: number, color: string) => {
    const teeth = Math.max(8, Math.round(r / 10));
    const points: string[] = [];
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2;
      const rr = i % 4 < 2 ? r : r * 0.84;
      points.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon points="${points.join(' ')}" fill="${color}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#ffffff" fill-opacity="0.18"/>`;
  };
  const body = items.slice(0, placed.length).map((item, i) => {
    const p = placed[i];
    return `${gear(p.x, p.y, p.r, pick(colors, i))}${label(p.x, p.y, item.text, p.r * 1.2, p.r > 80 ? 15 : 12)}`;
  }).join('');
  return { w: 640, h: 460, body };
};

const balanceLayout = (items: Item[], colors: string[]) => {
  const sides = items.slice(0, 2);
  const pan = (x: number, item: Item | undefined, color: string) => item ? `<line x1="${x}" y1="96" x2="${x - 70}" y2="210" stroke="#64748b" stroke-width="2"/><line x1="${x}" y1="96" x2="${x + 70}" y2="210" stroke="#64748b" stroke-width="2"/><path d="M${x - 90} 210 H${x + 90} Q${x} 270 ${x - 90} 210 Z" fill="${color}"/>${label(x, 168, item.text, 170, 15, '#1f2430', 700)}${item.children.map((child, j) => label(x, 300 + j * 24, child.text, 220, 12, '#1f2430', 400)).join('')}` : '';
  const rows = Math.max(0, ...sides.map((item) => item.children.length));
  return { w: 640, h: 310 + rows * 24, body: `<polygon points="320,90 290,300 350,300" fill="#475569"/><rect x="120" y="86" width="400" height="10" rx="5" fill="#475569"/><circle cx="320" cy="86" r="12" fill="#475569"/>${pan(150, sides[0], pick(colors, 0))}${pan(490, sides[1], pick(colors, 1))}` };
};

const circleProcess = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const step = 800 / count;
  const r = Math.min(60, step / 2 - 14);
  const body = items.map((item, i) => {
    const x = step * i + step / 2;
    const color = pick(colors, i);
    const next = i < count - 1 ? `<polygon points="${x + r + 6},${70 - 9} ${x + r + 20},70 ${x + r + 6},${70 + 9}" fill="#94a3b8"/>` : '';
    return `<circle cx="${x}" cy="70" r="${r}" fill="${color}"/>${label(x, 70, item.text, r * 1.6, 13)}${next}${item.children.map((child, j) => label(x, 70 + r + 24 + j * 22, child.text, step - 12, 12, '#1f2430', 400)).join('')}`;
  }).join('');
  const rows = Math.max(0, ...items.map((item) => item.children.length));
  return { w: 800, h: 70 + r + 10 + rows * 22 + (rows ? 14 : 0), body };
};

const stackedLayout = (items: Item[], colors: string[]) => {
  const count = Math.max(1, items.length);
  const layerH = 54;
  const body = items.map((item, i) => {
    const y = i * (layerH - 12);
    const inset = i * 12;
    return `<rect x="${inset}" y="${y}" width="${640 - inset * 2}" height="${layerH}" rx="27" fill="${pick(colors, i)}" stroke="#ffffff" stroke-width="3"/>${label(320, y + layerH / 2, item.text, 560 - inset * 2, 14)}`;
  }).reverse().join('');
  return { w: 640, h: (count - 1) * (layerH - 12) + layerH, body };
};

const LAYOUT_BUILDERS: Record<SmartArtLayout, (items: Item[], colors: string[]) => { w: number; h: number; body: string }> = {
  list: listLayout, vlist: verticalList, process: processLayout, cycle: cycleLayout, hierarchy: hierarchyLayout, relationship: relationshipLayout, matrix: matrixLayout, pyramid: pyramidLayout,
  timeline: timelineLayout, chevron: chevronList, bending: bendingLayout, steps: stepsLayout, funnel: funnelLayout, target: targetLayout, radial: radialLayout, compare: compareLayout,
  grid: gridLayout, growth: growthLayout, gear: gearLayout, balance: balanceLayout, circles: circleProcess, stacked: stackedLayout,
};

export function smartArtDataUrl(spec: SmartArtSpec) {
  const colors = (SMARTART_PALETTES.find((item) => item.id === spec.palette) ?? SMARTART_PALETTES[0]).colors;
  const items = parseItems(spec.text);
  const { w, h, body } = LAYOUT_BUILDERS[spec.layout](items, colors);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w) + 2}" height="${Math.ceil(h) + 2}" viewBox="-1 -1 ${Math.ceil(w) + 2} ${Math.ceil(h) + 2}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
