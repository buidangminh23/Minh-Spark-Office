import { conversionBaseName } from './conversionTypes';
import type { WordPhysicalPages } from './wordPageMap';

const mimeTypes = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export type PartsFormat = keyof typeof mimeTypes;
export const partsAccept = '.pdf,.docx,.xlsx,.pptx';

export function partsFormat(file: File): PartsFormat {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && Object.hasOwn(mimeTypes, extension)) return extension as PartsFormat;
  throw new Error('Chọn tệp PDF, DOCX, XLSX hoặc PPTX.');
}

export function partRanges(value: string, count: number): number[][] {
  return value.split(',').map((range) => {
    const match = /^(\d+)(?:\s*[-–—]\s*(\d+))?$/.exec(range.trim());
    const first = Number(match?.[1]);
    const last = Number(match?.[2] ?? first);
    if (!match || first < 1 || first > last || last > count) {
      throw new Error(`Nhập số hoặc khoảng từ 1 đến ${count}. Mỗi khoảng cách nhau bằng dấu phẩy.`);
    }
    return Array.from({ length: last - first + 1 }, (_, index) => first - 1 + index);
  });
}

async function partsEngine(format: PartsFormat) {
  switch (format) {
    case 'docx': {
      const word = await import('./wordFileParts');
      return { labels: word.wordPartLabels, merge: word.mergeWordFiles, split: word.splitWordFile };
    }
    case 'xlsx': {
      const excel = await import('./excelFileParts');
      return { labels: excel.excelPartLabels, merge: excel.mergeExcelFiles, split: excel.splitExcelFile };
    }
    case 'pptx': {
      const slides = await import('./slideFileParts');
      return { labels: slides.slidePartLabels, merge: slides.mergeSlideFiles, split: slides.splitSlideFile };
    }
    case 'pdf': {
      const pdf = await import('../editors/pdf/pdfTools');
      const read = async (file: File) => new Uint8Array(await file.arrayBuffer());
      return {
        labels: async (file: File) => {
          const doc = await pdf.loadPdf(await read(file), { keepAttributes: true });
          return doc.getPageIndices().map((index) => `Trang ${index + 1}`);
        },
        merge: async (files: File[]) => (await pdf.mergePdfs(await Promise.all(files.map(read)), { keepAttributes: true })).bytes,
        split: async (file: File, groups: number[][]) => pdf.splitPdf(await read(file), groups.map((pages) => ({ label: '', pages })), { keepAttributes: true }),
      };
    }
  }
}

export type WordSplitUnit = 'blocks' | 'pages';

export async function partLabels(file: File, unit: WordSplitUnit = 'blocks', layout?: WordPhysicalPages) {
  if (partsFormat(file) === 'docx' && unit === 'pages') {
    const { wordPageLabels } = await import('./wordFileParts');
    return wordPageLabels(file, layout);
  }
  return (await partsEngine(partsFormat(file))).labels(file);
}

function resultBlob(bytes: Uint8Array, format: PartsFormat) {
  return new Blob([new Uint8Array(bytes)], { type: mimeTypes[format] });
}

export async function mergeFiles(files: File[]) {
  if (files.length < 2) throw new Error('Chọn ít nhất hai tệp cùng định dạng để gộp.');
  const format = partsFormat(files[0]);
  if (files.some((file) => partsFormat(file) !== format)) throw new Error('Các tệp cần gộp phải cùng định dạng.');
  const engine = await partsEngine(format);
  const bytes = await engine.merge(files);
  return { blob: resultBlob(bytes, format), name: `${conversionBaseName(files[0].name)} - merged.${format}` };
}

export type PartResult = { blob: Blob; name: string };
export type PagePick = { file: File; index: number };

export function partFileName(stem: string, extension: string) {
  const clean = stem.replace(new RegExp(`\\.${extension}$`, 'i'), '').replace(/[\\/:*?"<>|]+/g, '_').trim();
  return `${clean || 'tep'}.${extension}`;
}

async function splitBytes(file: File, groups: number[][], unit: WordSplitUnit, layout?: WordPhysicalPages) {
  const format = partsFormat(file);
  if (format === 'docx' && unit === 'pages') return (await import('./wordFileParts')).splitWordPages(file, groups, layout);
  return (await partsEngine(format)).split(file, groups);
}

export async function splitParts(file: File, groups: number[][], unit: WordSplitUnit = 'blocks', layout?: WordPhysicalPages) {
  if (!groups.length || groups.some((pages) => !pages.length)) throw new Error('Mỗi tệp cần có ít nhất một trang.');
  const format = partsFormat(file);
  return (await splitBytes(file, groups, unit, layout)).map((bytes) => resultBlob(bytes, format));
}

export async function mergePages(picks: PagePick[], unit: WordSplitUnit = 'blocks') {
  if (!picks.length) throw new Error('Chọn ít nhất một trang để ghép.');
  const format = partsFormat(picks[0].file);
  if (picks.some((pick) => partsFormat(pick.file) !== format)) throw new Error('Các trang cần ghép phải cùng định dạng.');
  const files = [...new Set(picks.map((pick) => pick.file))];
  const singles = new Map<File, Map<number, Uint8Array>>();
  for (const file of files) {
    const indexes = [...new Set(picks.filter((pick) => pick.file === file).map((pick) => pick.index))];
    const parts = await splitBytes(file, indexes.map((index) => [index]), unit);
    singles.set(file, new Map(indexes.map((index, position) => [index, parts[position]])));
  }
  const ordered = picks.map((pick, position) => new File([new Uint8Array(singles.get(pick.file)!.get(pick.index)!)], `${position + 1}.${format}`, { type: mimeTypes[format] }));
  if (ordered.length === 1) return resultBlob(new Uint8Array(await ordered[0].arrayBuffer()), format);
  return resultBlob(await (await partsEngine(format)).merge(ordered), format);
}

export async function zipParts(parts: PartResult[], zipName: string): Promise<PartResult> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();
  for (const part of parts) {
    let name = part.name;
    const dot = name.lastIndexOf('.');
    for (let copy = 2; used.has(name.toLowerCase()); copy += 1) name = `${part.name.slice(0, dot)} (${copy})${part.name.slice(dot)}`;
    used.add(name.toLowerCase());
    zip.file(name, part.blob);
  }
  return { blob: await zip.generateAsync({ type: 'blob' }), name: partFileName(zipName, 'zip') };
}

export async function splitFile(file: File, groups: number[][], unit: WordSplitUnit = 'blocks', layout?: WordPhysicalPages) {
  const format = partsFormat(file);
  const base = conversionBaseName(file.name);
  const byWordPage = format === 'docx' && unit === 'pages';
  const results = await splitBytes(file, groups, unit, layout);
  const name = (index: number) => {
    const sequence = String(index + 1).padStart(String(results.length).length, '0');
    if (!byWordPage) return `${base} - ${sequence}.${format}`;
    const pages = groups[index];
    const range = pages.length === 1 ? String(pages[0] + 1) : `${pages[0] + 1}-${pages[pages.length - 1] + 1}`;
    const prefix = results.length === 1 ? base : `${base} - ${sequence}`;
    return `${prefix} - p${range}.docx`;
  };
  if (results.length === 1) return { blob: resultBlob(results[0], format), name: name(0) };
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  results.forEach((bytes, index) => zip.file(name(index), bytes));
  return { blob: await zip.generateAsync({ type: 'blob' }), name: `${base} - split.zip` };
}
