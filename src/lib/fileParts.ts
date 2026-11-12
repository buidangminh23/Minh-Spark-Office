import { conversionBaseName } from './conversionTypes';

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

export async function partLabels(file: File) {
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

export async function splitFile(file: File, groups: number[][]) {
  const format = partsFormat(file);
  const base = conversionBaseName(file.name);
  const engine = await partsEngine(format);
  const results = await engine.split(file, groups);
  const name = (index: number) => `${base} - ${String(index + 1).padStart(String(results.length).length, '0')}.${format}`;
  if (results.length === 1) return { blob: resultBlob(results[0], format), name: name(0) };
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  results.forEach((bytes, index) => zip.file(name(index), bytes));
  return { blob: await zip.generateAsync({ type: 'blob' }), name: `${base} - split.zip` };
}
