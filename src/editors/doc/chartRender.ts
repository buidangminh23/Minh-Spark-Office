import { CHART_PALETTES, CHART_TEMPLATES, drawBars, drawFunnel, drawLegend, drawLineChart, drawPie, drawRadar, drawScatter, drawWaterfall, parseChartData, text, TEXT, type ChartKind, type ChartSpec, type Draw } from './insertCharts';
import { drawBox, drawBubble, drawColumn3d, drawGantt, drawGauge, drawHeatmap, drawHistogram, drawPareto, drawPolarArea, drawScatterLine, drawStock, drawSunburst, drawTreemap } from './insertChartsExtra';

const RENDERERS: Record<ChartKind, (d: Draw) => void> = {
  column: (d) => drawBars(d, false), 'column-stacked': (d) => drawBars(d, false), 'column-percent': (d) => drawBars(d, false), combo: (d) => drawBars(d, false), 'column-3d': drawColumn3d,
  bar: (d) => drawBars(d, true), 'bar-stacked': (d) => drawBars(d, true), 'bar-percent': (d) => drawBars(d, true),
  line: drawLineChart, 'line-smooth': drawLineChart, area: drawLineChart, 'area-stacked': drawLineChart, 'area-percent': drawLineChart,
  pie: drawPie, 'pie-exploded': drawPie, doughnut: drawPie, 'polar-area': drawPolarArea, sunburst: drawSunburst, treemap: drawTreemap,
  radar: drawRadar, 'radar-filled': drawRadar, scatter: drawScatter, 'scatter-line': drawScatterLine, bubble: drawBubble,
  stock: drawStock, histogram: drawHistogram, pareto: drawPareto, box: drawBox, heatmap: drawHeatmap,
  funnel: drawFunnel, waterfall: drawWaterfall, gauge: drawGauge, gantt: drawGantt,
};

const POLAR = new Set<ChartKind>(['pie', 'pie-exploded', 'doughnut', 'polar-area', 'sunburst', 'treemap', 'radar', 'radar-filled', 'funnel', 'gauge', 'heatmap']);
const LEFT_LABELS = new Set<ChartKind>(['bar', 'bar-stacked', 'bar-percent', 'gantt']);
const SINGLE_SERIES = new Set<ChartKind>(['bubble', 'stock', 'histogram', 'pareto', 'box', 'gauge', 'gantt', 'waterfall', 'heatmap']);

export function renderChart(canvas: HTMLCanvasElement, spec: ChartSpec, options: { mini?: boolean } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const mini = Boolean(options.mini);
  const scale = mini ? 1 : 2;
  const width = canvas.width / scale;
  const height = canvas.height / scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const data = parseChartData(spec.raw);
  const colors = (CHART_PALETTES.find((item) => item.id === spec.palette) ?? CHART_PALETTES[0]).colors;
  const polar = POLAR.has(spec.kind);
  const legend = !mini && spec.legend && data.series.length > 1 && !polar && !SINGLE_SERIES.has(spec.kind);
  const box = mini
    ? { left: 8, top: 8, right: width - 8, bottom: height - 8 }
    : { left: polar ? 24 : LEFT_LABELS.has(spec.kind) ? 120 : 64, top: spec.title ? 52 : 20, right: width - (spec.kind === 'pareto' || spec.kind === 'combo' ? 52 : 28), bottom: height - (legend ? 50 : polar ? 20 : 36) };
  const draw: Draw = { ctx, data, colors, spec, box, mini, width, height };
  if (spec.title) text(draw, spec.title, width / 2, 28, 'center', 18, TEXT, 600);
  if (!data.categories.length) return;
  RENDERERS[spec.kind](draw);
  if (legend) drawLegend(draw);
}

export function chartDataUrl(spec: ChartSpec) {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 840;
  renderChart(canvas, spec);
  return canvas.toDataURL('image/png');
}

export function chartThumb(kind: ChartKind, palette: string) {
  const template = CHART_TEMPLATES.find((item) => item.kind === kind) ?? CHART_TEMPLATES[0];
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 80;
  renderChart(canvas, { kind, title: '', raw: template.raw, palette, legend: false, labels: false, grid: true }, { mini: true });
  return canvas.toDataURL('image/png');
}
