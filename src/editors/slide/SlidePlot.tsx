import React from 'react';
import type { ChartAxis, SlideElement } from '../../lib/slideTypes';

function scale(values: number[], axis: ChartAxis | undefined, intervals: number) {
  let low = 0;
  let high = 0;
  for (const value of values) {
    if (Number.isFinite(value)) {
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }
  low = axis?.min ?? low;
  high = axis?.max ?? high;
  if (high <= low) high = low + 1;
  const estimate = (high - low) / intervals;
  const unit = 10 ** Math.floor(Math.log10(estimate));
  const nice = ([1, 2, 5, 10].find((step) => step * unit >= estimate) ?? 10) * unit;
  const step = axis?.majorUnit && axis.majorUnit > 0 ? axis.majorUnit : nice;
  const min = axis?.min ?? Math.floor(low / step) * step;
  const max = axis?.max ?? Math.ceil(high / step) * step;
  const ticks = [];
  for (let i = 0; i < 100 && min + i * step <= max + step * 1e-8; i++) {
    ticks.push(Number((min + i * step).toPrecision(12)));
  }
  return { min, max, ticks, fraction: (v: number) => (v - min) / (max - min || 1) };
}

const tickLabel = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 });

export function SlidePlot({ el, width, height }: { el: SlideElement; width: number; height: number }) {
  const clip = React.useId();
  const series = el.chartSeries ?? [];
  const categories = el.chartCategories ?? [];
  const scatter = el.chartType === 'scatter';
  const stacked = Boolean(el.chartGrouping);
  const percent = el.chartGrouping === 'percentStacked';
  const positive = categories.map(() => 0);
  const negative = categories.map(() => 0);
  for (const item of series) {
    categories.forEach((_, i) => {
      const n = item.values[i] || 0;
      if (n > 0) positive[i] += n;
      else negative[i] += n;
    });
  }
  const totals = percent ? [negative.some((v) => v < 0) ? -1 : 0, 1] : [...positive, ...negative];
  const ys = scale(stacked && !scatter ? totals : series.flatMap((s) => s.values), el.chartYAxis, 6);
  const xs = scale(scatter ? series.flatMap((s) => s.values.map((_, j) => s.xValues?.[j] ?? j + 1)) : [], el.chartXAxis, 8);
  const labels = ys.ticks.map((v) => percent ? `${Math.round(v * 100)}%` : tickLabel.format(v));
  const legend: { x: number; y: number; index: number }[] = [];
  let rows = 0;
  if (el.chartLegend ?? series.length > 1) {
    let x = 0;
    let start = 0;
    const centerRow = () => {
      const offset = Math.max(0, (width - x + 8) / 2);
      for (let i = start; i < legend.length; i++) legend[i].x += offset;
    };
    for (const [index, item] of series.entries()) {
      const size = 18 + item.name.length * 5.8;
      if (x > 0 && x + size > width - 10) {
        centerRow();
        start = legend.length;
        x = 0;
        rows++;
      }
      legend.push({ x, y: rows * 15, index });
      x += size;
    }
    if (legend.length) {
      centerRow();
      rows++;
    }
  }
  const left = Math.min(width * 0.4, Math.max(20, ...labels.map((label) => label.length * 6.5 + 8)) + (el.chartYAxis?.title ? 16 : 0));
  const right = Math.max(left + 1, width - 12);
  const top = el.chartTitle ? 31 : 8;
  const bottom = Math.max(top + 1, height - 24 - rows * 15 - (el.chartXAxis?.title ? 18 : 0));
  const y = (value: number) => bottom - ys.fraction(value) * (bottom - top);
  const x = (value: number) => left + xs.fraction(value) * (right - left);
  const band = (right - left) / Math.max(categories.length, 1);
  const slot = band / (1 + (el.chartGapWidth ?? 100) / 100);
  const plots: React.ReactNode[] = [];
  if (scatter) {
    series.forEach((item, i) => {
      const points = item.values.map((v, j) => ({ x: x(item.xValues?.[j] ?? j + 1), y: y(v) }));
      if (item.showLine) plots.push(<polyline key={`line-${i}`} fill="none" stroke={item.color} strokeWidth={1.5} points={points.map((p) => `${p.x},${p.y}`).join(' ')} />);
      if (item.markerSize !== 0) points.forEach((p, j) => {
        plots.push(<circle key={`point-${i}-${j}`} cx={p.x} cy={p.y} r={(item.markerSize ?? 5) / 2} fill={item.color}><title>{`${item.name}: ${item.xValues?.[j] ?? j + 1}, ${item.values[j]}`}</title></circle>);
      });
    });
  } else {
    categories.forEach((category, i) => {
      let above = 0;
      let below = 0;
      series.forEach((item, j) => {
        let n = item.values[i] || 0;
        if (!n) return;
        if (percent) n /= n > 0 ? positive[i] : -negative[i];
        const start = stacked ? (n > 0 ? above : below) : 0;
        if (n > 0) above += n;
        else below += n;
        const bar = stacked ? slot : slot / series.length;
        const px = left + (i + 0.5) * band - slot / 2 + (stacked ? 0 : j * bar);
        plots.push(<rect key={`${i}-${j}`} x={px} y={Math.min(y(start), y(start + n))} width={bar} height={Math.abs(y(start) - y(start + n))} fill={item.color}><title>{`${item.name}, ${category}: ${item.values[i]}`}</title></rect>);
      });
    });
  }
  return <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={el.chartTitle || 'Biểu đồ'} fontFamily="Segoe UI, sans-serif" fontSize={11} fill="#464646">
    <defs><clipPath id={clip}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
    {el.chartTitle && <text x={width / 2} y={19} textAnchor="middle" fontSize={15}>{el.chartTitle}</text>}
    {ys.ticks.map((v, i) => <g key={v}>
      {el.chartYAxis?.gridLines !== false && <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#d2d2d2" strokeWidth={0.7} />}
      <text x={left - 5} y={y(v)} dominantBaseline="middle" textAnchor="end">{labels[i]}</text>
    </g>)}
    {scatter && xs.ticks.map((v) => <g key={v}>
      {el.chartXAxis?.gridLines && <line x1={x(v)} x2={x(v)} y1={top} y2={bottom} stroke="#d2d2d2" strokeWidth={0.7} />}
      <text x={x(v)} y={bottom + 14} textAnchor="middle">{tickLabel.format(v)}</text>
    </g>)}
    {!scatter && categories.map((label, i) => <text key={i} x={left + (i + 0.5) * band} y={bottom + 14} textAnchor="middle">{label}</text>)}
    <path d={`M${left},${top}V${bottom}H${right}`} stroke="#888" strokeWidth={0.7} fill="none" />
    <g clipPath={`url(#${clip})`}>{plots}</g>
    {el.chartXAxis?.title && <text x={(left + right) / 2} y={bottom + 31} textAnchor="middle" fontSize={12}>{el.chartXAxis.title}</text>}
    {el.chartYAxis?.title && <text transform={`translate(12 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12}>{el.chartYAxis.title}</text>}
    {legend.map(({ x, y, index }) => <g key={index} transform={`translate(${x} ${height - 5 - (rows - 1) * 15 + y})`}>
      {scatter ? <circle cx={3} cy={-4} r={3} fill={series[index].color} /> : <rect x={0} y={-8} width={8} height={8} fill={series[index].color} />}
      <text x={11}>{series[index].name}</text>
    </g>)}
  </svg>;
}
