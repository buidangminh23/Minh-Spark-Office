import { categoryAxis, color, fmt, GRID, niceRange, smoothPath, text, TEXT, valueAxis, type Draw } from './insertCharts';

const shade = (hex: string, amount: number) => {
  const value = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) + amount * 255)));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
};

const spanRange = (min: number, max: number, ticks = 5) => {
  if (max <= min) return niceRange(min, min + 1, ticks);
  const raw = (max - min) / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
};

const xAxis = (d: Draw, range: { min: number; max: number; step: number }) => {
  const { box } = d;
  const pos = (v: number) => box.left + ((v - range.min) / (range.max - range.min || 1)) * (box.right - box.left);
  for (let v = range.min; v <= range.max + range.step / 2; v += range.step) text(d, fmt(v), pos(v), box.bottom + 14, 'center', 11);
  return pos;
};

export const drawColumn3d = (d: Draw) => {
  const { ctx, data } = d;
  const all = data.series.flatMap((s) => s.values);
  const pos = valueAxis(d, niceRange(Math.min(0, ...all), Math.max(...all, 1)), false);
  const cat = categoryAxis(d, false);
  const group = cat.size * 0.7;
  const bar = group / Math.max(1, data.series.length);
  const depth = Math.min(14, bar * 0.4);
  data.categories.forEach((_, c) => data.series.forEach((s, i) => {
    const x = cat.center(c) - group / 2 + bar * i;
    const w = bar - depth * 0.6;
    const top = Math.min(pos(0), pos(s.values[c]));
    const h = Math.abs(pos(s.values[c]) - pos(0));
    const base = color(d, i);
    ctx.fillStyle = shade(base, 0.18);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + depth, top - depth * 0.7); ctx.lineTo(x + w + depth, top - depth * 0.7); ctx.lineTo(x + w, top); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(base, -0.18);
    ctx.beginPath(); ctx.moveTo(x + w, top); ctx.lineTo(x + w + depth, top - depth * 0.7); ctx.lineTo(x + w + depth, top + h - depth * 0.7); ctx.lineTo(x + w, top + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = base;
    ctx.fillRect(x, top, w, h);
    if (d.spec.labels) text(d, fmt(s.values[c]), x + w / 2, top - depth - 6, 'center', 10, TEXT);
  }));
};

export const drawBubble = (d: Draw) => {
  const { ctx, data } = d;
  const [xs, ys, sizes] = [data.series[0]?.values ?? [], data.series[1]?.values ?? [], data.series[2]?.values ?? []];
  const pos = valueAxis(d, spanRange(Math.min(...ys), Math.max(...ys)), false);
  const xpos = xAxis(d, spanRange(Math.min(...xs), Math.max(...xs)));
  const maxSize = Math.max(...sizes.map(Math.abs), 1);
  const maxR = d.mini ? 10 : 34;
  data.categories.forEach((name, i) => {
    const r = Math.max(3, Math.sqrt(Math.abs(sizes[i] ?? 1) / maxSize) * maxR);
    ctx.beginPath();
    ctx.arc(xpos(xs[i]), pos(ys[i]), r, 0, Math.PI * 2);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = color(d, i);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (d.spec.labels) text(d, name, xpos(xs[i]), pos(ys[i]), 'center', 11, '#ffffff', 600);
  });
};

export const drawStock = (d: Draw) => {
  const { ctx, data } = d;
  const [open, high, low, close] = [0, 1, 2, 3].map((i) => data.series[i]?.values ?? []);
  const pos = valueAxis(d, spanRange(Math.min(...low, ...open), Math.max(...high, ...close)), false);
  const cat = categoryAxis(d, false);
  const body = cat.size * 0.5;
  data.categories.forEach((_, i) => {
    const up = (close[i] ?? 0) >= (open[i] ?? 0);
    const fill = up ? '#16a34a' : '#dc2626';
    const x = cat.center(i);
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, pos(high[i] ?? 0)); ctx.lineTo(x, pos(low[i] ?? 0)); ctx.stroke();
    const top = pos(Math.max(open[i] ?? 0, close[i] ?? 0));
    ctx.fillStyle = fill;
    ctx.fillRect(x - body / 2, top, body, Math.max(1.5, Math.abs(pos(open[i] ?? 0) - pos(close[i] ?? 0))));
  });
};

export const drawHistogram = (d: Draw) => {
  const { ctx, box } = d;
  const values = (d.data.series[0]?.values ?? []).filter(Number.isFinite);
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = Math.max(3, Math.ceil(Math.log2(values.length) + 1));
  const width = (max - min || 1) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  values.forEach((v) => { counts[Math.min(bins - 1, Math.floor((v - min) / width))] += 1; });
  const pos = valueAxis(d, niceRange(0, Math.max(...counts, 1), 4), false);
  const step = (box.right - box.left) / bins;
  counts.forEach((count, i) => {
    const x = box.left + i * step;
    ctx.fillStyle = color(d, 0);
    ctx.fillRect(x + 1, pos(count), step - 2, pos(0) - pos(count));
    text(d, `${fmt(min + i * width)}–${fmt(min + (i + 1) * width)}`, x + step / 2, box.bottom + 14, 'center', 10);
    if (d.spec.labels && count) text(d, String(count), x + step / 2, pos(count) - 9, 'center', 10, TEXT);
  });
};

export const drawPareto = (d: Draw) => {
  const { ctx, box } = d;
  const rows = d.data.categories.map((name, i) => ({ name, value: Math.max(0, d.data.series[0]?.values[i] ?? 0) })).sort((a, b) => b.value - a.value);
  const sorted = { ...d, data: { categories: rows.map((r) => r.name), series: [{ name: d.data.series[0]?.name ?? '', values: rows.map((r) => r.value) }] } };
  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1;
  const pos = valueAxis(sorted, niceRange(0, Math.max(...rows.map((r) => r.value), 1)), false);
  const cat = categoryAxis(sorted, false);
  const pct = (p: number) => box.bottom - (p / 100) * (box.bottom - box.top);
  for (let p = 0; p <= 100; p += 20) text(d, `${p}%`, box.right + 6, pct(p), 'left', 10);
  let acc = 0;
  const points: [number, number][] = rows.map((r, i) => {
    ctx.fillStyle = color(d, 0);
    ctx.fillRect(cat.center(i) - cat.size * 0.36, pos(r.value), cat.size * 0.72, pos(0) - pos(r.value));
    acc += r.value;
    return [cat.center(i), pct((acc / total) * 100)];
  });
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color(d, 1);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  points.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = color(d, 1); ctx.fill(); });
};

const quantile = (sorted: number[], q: number) => {
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  return sorted[lo] + (sorted[Math.min(sorted.length - 1, lo + 1)] - sorted[lo]) * (at - lo);
};

export const drawBox = (d: Draw) => {
  const { ctx, data } = d;
  const groups = data.series.map((s) => [...s.values].sort((a, b) => a - b));
  const all = groups.flat();
  const asCategories = { ...d, data: { categories: data.series.map((s) => s.name), series: data.series } };
  const pos = valueAxis(d, spanRange(Math.min(...all), Math.max(...all)), false);
  const cat = categoryAxis(asCategories, false);
  groups.forEach((values, i) => {
    if (!values.length) return;
    const [q1, median, q3] = [0.25, 0.5, 0.75].map((q) => quantile(values, q));
    const fence = (q3 - q1) * 1.5;
    const inside = values.filter((v) => v >= q1 - fence && v <= q3 + fence);
    const x = cat.center(i);
    const w = cat.size * 0.4;
    const fill = color(d, i);
    ctx.strokeStyle = shade(fill, -0.25);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, pos(inside[0])); ctx.lineTo(x, pos(q1)); ctx.moveTo(x, pos(q3)); ctx.lineTo(x, pos(inside[inside.length - 1]));
    ctx.moveTo(x - w / 4, pos(inside[0])); ctx.lineTo(x + w / 4, pos(inside[0])); ctx.moveTo(x - w / 4, pos(inside[inside.length - 1])); ctx.lineTo(x + w / 4, pos(inside[inside.length - 1])); ctx.stroke();
    ctx.fillStyle = fill;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x - w / 2, pos(q3), w, pos(q1) - pos(q3));
    ctx.globalAlpha = 1;
    ctx.strokeRect(x - w / 2, pos(q3), w, pos(q1) - pos(q3));
    ctx.beginPath(); ctx.moveTo(x - w / 2, pos(median)); ctx.lineTo(x + w / 2, pos(median)); ctx.lineWidth = 2.5; ctx.stroke();
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    text(d, '×', x, pos(mean), 'center', 13, '#ffffff', 700);
    values.filter((v) => !inside.includes(v)).forEach((v) => { ctx.beginPath(); ctx.arc(x, pos(v), 3, 0, Math.PI * 2); ctx.stroke(); });
  });
};

type Rect = { x: number; y: number; w: number; h: number };

const squarify = (values: number[], rect: Rect): Rect[] => {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (!values.length || total <= 0) return [];
  if (values.length === 1) return [rect];
  let split = 1;
  let acc = values[0];
  while (split < values.length - 1 && acc < total / 2) acc += values[split++];
  const ratio = acc / total;
  const horizontal = rect.w >= rect.h;
  const first: Rect = horizontal ? { ...rect, w: rect.w * ratio } : { ...rect, h: rect.h * ratio };
  const rest: Rect = horizontal ? { x: rect.x + first.w, y: rect.y, w: rect.w - first.w, h: rect.h } : { x: rect.x, y: rect.y + first.h, w: rect.w, h: rect.h - first.h };
  return [...squarify(values.slice(0, split), first), ...squarify(values.slice(split), rest)];
};

export const drawTreemap = (d: Draw) => {
  const { ctx, box, data } = d;
  const rows = data.categories.map((name, i) => ({ name, value: Math.max(0, data.series[0]?.values[i] ?? 0), i })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const rects = squarify(rows.map((r) => r.value), { x: box.left, y: box.top, w: box.right - box.left, h: box.bottom - box.top });
  rects.forEach((r, k) => {
    ctx.fillStyle = color(d, k);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (r.w > 60 && r.h > 34) {
      text(d, rows[k].name, r.x + 8, r.y + 14, 'left', 12, '#ffffff', 700);
      text(d, fmt(rows[k].value), r.x + 8, r.y + 30, 'left', 11, '#ffffff');
    }
  });
};

export const drawSunburst = (d: Draw) => {
  const { ctx, box, data } = d;
  const items = data.categories.map((name, i) => {
    const parts = name.split(/\s*[>/]\s*/);
    return { group: parts.length > 1 ? parts[0] : name, name: parts[parts.length - 1], value: Math.max(0, data.series[0]?.values[i] ?? 0) };
  });
  const groups = [...new Set(items.map((item) => item.group))];
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const radius = Math.min(box.right - box.left, box.bottom - box.top) / 2 - 4;
  const ring = (start: number, sweep: number, r0: number, r1: number, fill: string, label: string) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r1, start, start + sweep);
    ctx.arc(cx, cy, r0, start + sweep, start, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (sweep > 0.35) text(d, label, cx + ((r0 + r1) / 2) * Math.cos(start + sweep / 2), cy + ((r0 + r1) / 2) * Math.sin(start + sweep / 2), 'center', 11, '#ffffff', 600);
  };
  let angle = -Math.PI / 2;
  groups.forEach((group, g) => {
    const children = items.filter((item) => item.group === group);
    const sum = children.reduce((s, item) => s + item.value, 0);
    const base = color(d, g);
    ring(angle, (sum / total) * Math.PI * 2, radius * 0.22, radius * 0.58, base, group);
    let inner = angle;
    children.forEach((child, k) => {
      const sweep = (child.value / total) * Math.PI * 2;
      if (children.length > 1 || child.name !== group) ring(inner, sweep, radius * 0.6, radius, shade(base, 0.08 + k * 0.07), child.name);
      inner += sweep;
    });
    angle += (sum / total) * Math.PI * 2;
  });
};

export const drawGauge = (d: Draw) => {
  const { ctx, box, data } = d;
  const value = data.series[0]?.values[0] ?? 0;
  const max = data.series[1]?.values[0] || niceRange(0, Math.max(value, 1)).max;
  const ratio = Math.max(0, Math.min(1, value / max));
  const cx = (box.left + box.right) / 2;
  const radius = Math.min((box.right - box.left) / 2, box.bottom - box.top - (d.mini ? 8 : 96)) - 6;
  const cy = box.top + radius + (d.mini ? 4 : 10);
  const thick = radius * 0.28;
  const arc = (from: number, to: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI + from * Math.PI, Math.PI + to * Math.PI);
    ctx.arc(cx, cy, radius - thick, Math.PI + to * Math.PI, Math.PI + from * Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  arc(0, 1, '#e5e7eb');
  arc(0, ratio, ratio < 0.4 ? '#dc2626' : ratio < 0.7 ? '#f59e0b' : '#16a34a');
  const needle = Math.PI + ratio * Math.PI;
  ctx.strokeStyle = TEXT;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (radius - thick / 2) * Math.cos(needle), cy + (radius - thick / 2) * Math.sin(needle)); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fillStyle = TEXT; ctx.fill();
  text(d, fmt(value), cx, cy + 34, 'center', 28, TEXT, 700);
  text(d, `${Math.round(ratio * 100)}% của ${fmt(max)}`, cx, cy + 62, 'center', 12);
  text(d, data.categories[0] ?? '', cx, cy + 82, 'center', 13, TEXT, 600);
  text(d, '0', cx - radius + thick / 2, cy + 14, 'center', 11);
  text(d, fmt(max), cx + radius - thick / 2, cy + 14, 'center', 11);
};

export const drawGantt = (d: Draw) => {
  const { ctx, data } = d;
  const starts = data.series[0]?.values ?? [];
  const lengths = data.series[1]?.values ?? [];
  const ends = starts.map((s, i) => s + (lengths[i] ?? 0));
  const xpos = xAxis(d, spanRange(Math.min(...starts, 0), Math.max(...ends, 1)));
  const cat = categoryAxis(d, true);
  data.categories.forEach((_, i) => {
    const h = cat.size * 0.56;
    ctx.fillStyle = color(d, i);
    ctx.fillRect(xpos(starts[i]), cat.center(i) - h / 2, Math.max(2, xpos(ends[i]) - xpos(starts[i])), h);
    if (d.spec.labels) text(d, `${fmt(lengths[i] ?? 0)} ngày`, xpos(ends[i]) + 6, cat.center(i), 'left', 10, TEXT);
  });
};

export const drawHeatmap = (d: Draw) => {
  const { ctx, box, data } = d;
  const values = data.series.flatMap((s) => s.values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cols = data.series.length;
  const rows = data.categories.length;
  const left = d.mini ? box.left : box.left + 40;
  const top = d.mini ? box.top : box.top + 18;
  const cw = (box.right - left) / Math.max(1, cols);
  const ch = (box.bottom - top) / Math.max(1, rows);
  const base = parseInt(color(d, 0).replace('#', ''), 16);
  const mix = (t: number) => `rgb(${[16, 8, 0].map((shift) => Math.round(241 + (((base >> shift) & 255) - 241) * t)).join(',')})`;
  data.series.forEach((s, c) => {
    text(d, s.name, left + c * cw + cw / 2, top - 10, 'center', 11, TEXT, 600);
    s.values.forEach((v, r) => {
      const t = max > min ? (v - min) / (max - min) : 1;
      ctx.fillStyle = mix(t);
      ctx.fillRect(left + c * cw + 1, top + r * ch + 1, cw - 2, ch - 2);
      if (d.spec.labels) text(d, fmt(v), left + c * cw + cw / 2, top + r * ch + ch / 2, 'center', 11, t > 0.55 ? '#ffffff' : TEXT);
    });
  });
  data.categories.forEach((name, r) => text(d, name, left - 6, top + r * ch + ch / 2, 'right', 11, TEXT));
};

export const drawPolarArea = (d: Draw) => {
  const { ctx, box, data } = d;
  const values = (data.series[0]?.values ?? []).map((v) => Math.max(0, v));
  const max = Math.max(...values, 1);
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const radius = Math.min(box.right - box.left, box.bottom - box.top) / 2 - (d.mini ? 4 : 20);
  const sweep = (Math.PI * 2) / Math.max(1, values.length);
  ctx.strokeStyle = GRID;
  for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, (radius * k) / 4, 0, Math.PI * 2); ctx.stroke(); }
  values.forEach((v, i) => {
    const start = -Math.PI / 2 + i * sweep;
    const r = Math.sqrt(v / max) * radius;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + sweep); ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color(d, i);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    const mid = start + sweep / 2;
    text(d, data.categories[i], cx + (radius + 12) * Math.cos(mid), cy + (radius + 12) * Math.sin(mid), Math.cos(mid) < -0.2 ? 'right' : Math.cos(mid) > 0.2 ? 'left' : 'center', 11, TEXT);
  });
};

export const drawScatterLine = (d: Draw) => {
  const { ctx, box, data } = d;
  const xs = data.categories.map((c) => Number(c.replace(',', '.')));
  const finite = xs.filter(Number.isFinite);
  const xpos = xAxis(d, spanRange(Math.min(...finite), Math.max(...finite)));
  const all = data.series.flatMap((s) => s.values);
  const pos = valueAxis(d, niceRange(Math.min(0, ...all), Math.max(...all, 1)), false);
  data.series.forEach((s, k) => {
    const points = s.values.map((v, i) => [xpos(xs[i]), pos(v)] as [number, number]).filter(([x]) => Number.isFinite(x) && x >= box.left - 1).sort((a, b) => a[0] - b[0]);
    if (!points.length) return;
    ctx.beginPath();
    smoothPath(ctx, points);
    ctx.strokeStyle = color(d, k);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    points.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, d.mini ? 2 : 4, 0, Math.PI * 2); ctx.fillStyle = color(d, k); ctx.fill(); });
  });
};
