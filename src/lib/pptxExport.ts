import PptxGenJS from 'pptxgenjs';
import type { PresentationData, ShapeType } from './slideTypes';
import { downloadBlob } from './download';

function mapShapeType(pres: PptxGenJS, shapeType?: ShapeType): string {
  const shapes = pres.ShapeType;
  switch (shapeType) {
    case 'rectangle': return shapes.rect || 'rect';
    case 'rounded-rectangle': return shapes.roundRect || 'roundRect';
    case 'circle': return shapes.ellipse || 'ellipse';
    case 'triangle': return shapes.triangle || 'triangle';
    case 'right-arrow': return shapes.rightArrow || 'rightArrow';
    case 'left-arrow': return shapes.leftArrow || 'leftArrow';
    case 'up-arrow': return shapes.upArrow || 'upArrow';
    case 'down-arrow': return shapes.downArrow || 'downArrow';
    case 'star': return shapes.star5 || 'star5';
    case 'callout': return shapes.wedgeRectCallout || 'wedgeRectCallout';
    case 'heart': return shapes.heart || 'heart';
    case 'diamond': return shapes.diamond || 'diamond';
    case 'hexagon': return shapes.hexagon || 'hexagon';
    case 'line': return shapes.line || 'line';
    default: return shapes.rect || 'rect';
  }
}

function cleanHex(color?: string): string {
  if (!color) return '000000';
  if (color.startsWith('#')) return color.slice(1, 7);
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10).toString(16).padStart(2, '0');
      const g = parseInt(match[1], 10).toString(16).padStart(2, '0');
      const b = parseInt(match[2], 10).toString(16).padStart(2, '0');
      return `${r}${g}${b}`;
    }
  }
  return '000000';
}

export async function exportToPptx(
  presentation: PresentationData,
  fileName = 'Bai-thuyet-trinh.pptx'
): Promise<void> {
  const pres = new PptxGenJS();

  pres.layout = presentation.aspectRatio === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9';
  pres.title = presentation.title || 'Minh Spark Office Presentation';
  pres.author = presentation.author || 'Minh Spark Office';

  for (const slideData of presentation.slides) {
    if (slideData.hidden) continue;

    const slide = pres.addSlide();

    // Background color
    if (slideData.background.type === 'solid' && slideData.background.value) {
      slide.background = { color: cleanHex(slideData.background.value) };
    } else {
      slide.background = { color: 'FFFFFF' };
    }

    // Speaker notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    // Add elements
    for (const el of slideData.elements) {
      const x = `${el.x}%` as any;
      const y = `${el.y}%` as any;
      const w = `${el.width}%` as any;
      const h = `${el.height}%` as any;

      if (el.type === 'text' && el.text) {
        slide.addText(el.text, {
          x,
          y,
          w,
          h,
          fontSize: el.fontSize || 18,
          fontFace: el.fontFamily?.replace(/['"]/g, '').split(',')[0] || 'Segoe UI',
          color: cleanHex(el.color || '#000000'),
          bold: el.fontWeight === 'bold',
          italic: el.fontStyle === 'italic',
          underline: el.textDecoration === 'underline' ? { style: 'sng' } : undefined,
          align: (el.textAlign || 'left') as any,
          valign: (el.verticalAlign || 'top') as any,
          bullet: el.isBullet ? true : false,
        });
      } else if (el.type === 'shape') {
        const shapeName = mapShapeType(pres, el.shapeType);
        slide.addShape(shapeName as any, {
          x,
          y,
          w,
          h,
          fill: { color: cleanHex(el.fill || '#0284C7') },
          line: {
            color: cleanHex(el.stroke || '#0284C7'),
            width: el.strokeWidth || 1,
          },
        });

        if (el.text) {
          slide.addText(el.text, {
            x,
            y,
            w,
            h,
            fontSize: el.fontSize || 18,
            color: cleanHex(el.color || '#FFFFFF'),
            align: 'center',
            valign: 'middle',
            bold: true,
          });
        }
      } else if (el.type === 'image' && el.src) {
        if (el.src.startsWith('data:image')) {
          slide.addImage({
            data: el.src,
            x,
            y,
            w,
            h,
          });
        } else if (el.src.startsWith('http')) {
          slide.addImage({
            path: el.src,
            x,
            y,
            w,
            h,
          });
        }
      } else if (el.type === 'table' && el.tableData) {
        const tableRows = el.tableData.map((row, rIdx) => {
          const isHeader = rIdx === 0 && el.tableHeaderRow;
          return row.map((cell) => ({
            text: cell,
            options: {
              fill: isHeader ? { color: cleanHex(el.tableHeaderColor || '#D83B01') } : { color: rIdx % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
              color: isHeader ? cleanHex(el.tableHeaderTextColor || '#FFFFFF') : '1E293B',
              bold: isHeader,
              align: 'center',
              valign: 'middle',
            },
          }));
        });

        slide.addTable(tableRows as any, {
          x,
          y,
          w,
          h,
          border: { type: 'solid', pt: 1, color: 'CBD5E1' },
        });
      } else if (el.type === 'chart' && el.chartSeries && el.chartCategories) {
        let presChartType = pres.ChartType.bar;
        if (el.chartType === 'column') presChartType = pres.ChartType.bar;
        else if (el.chartType === 'line') presChartType = pres.ChartType.line;
        else if (el.chartType === 'pie') presChartType = pres.ChartType.pie;
        else if (el.chartType === 'doughnut') presChartType = pres.ChartType.doughnut;

        const chartData = el.chartSeries.map((s) => ({
          name: s.name,
          labels: el.chartCategories!,
          values: s.values,
        }));

        slide.addChart(presChartType, chartData, {
          x,
          y,
          w,
          h,
          showTitle: Boolean(el.chartTitle),
          title: el.chartTitle || '',
        });
      }
    }
  }

  const outName = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
  const blob = (await pres.write({ outputType: 'blob' })) as Blob;
  downloadBlob(blob, outName);
}
