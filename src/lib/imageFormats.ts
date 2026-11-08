import { PDFDocument } from 'pdf-lib';

export const SUPPORTED_IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'jpe',
  'webp',
  'gif',
  'svg',
  'svgz',
  'bmp',
  'dib',
  'ico',
  'avif',
  'tiff',
  'tif',
  'heic',
  'heif',
] as const;

export const IMAGE_EXTENSIONS_PATTERN =
  /\.(png|jpe?g|jfif|jpe|webp|gif|svg|svgz|bmp|dib|ico|avif|tiff?|heic|heif)$/i;

export const IMAGE_ACCEPT_STRING =
  '.png,.jpg,.jpeg,.jfif,.jpe,.webp,.gif,.svg,.svgz,.bmp,.dib,.ico,.avif,.tiff,.tif,.heic,.heif';

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS_PATTERN.test(fileName);
}

export function getImageMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
    case 'jfif':
    case 'jpe':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
    case 'svgz':
      return 'image/svg+xml';
    case 'bmp':
    case 'dib':
      return 'image/bmp';
    case 'ico':
      return 'image/x-icon';
    case 'avif':
      return 'image/avif';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return 'image/png';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatResolution(width: number, height: number): string {
  const mp = ((width * height) / 1_000_000).toFixed(1);
  return `${width} × ${height} (${mp} MP)`;
}

export function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) return '';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  const ratioW = Math.round(width / divisor);
  const ratioH = Math.round(height / divisor);
  if (ratioW <= 32 && ratioH <= 32) {
    return `${ratioW}:${ratioH}`;
  }
  const decimal = width / height;
  if (Math.abs(decimal - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(decimal - 4 / 3) < 0.05) return '4:3';
  if (Math.abs(decimal - 3 / 2) < 0.05) return '3:2';
  if (Math.abs(decimal - 1) < 0.05) return '1:1';
  if (Math.abs(decimal - 9 / 16) < 0.05) return '9:16';
  return `${decimal.toFixed(2)}:1`;
}

function decodeBaselineTiff(bytes: Uint8Array): string | null {
  if (bytes.length < 8) return null;
  const isLittle = bytes[0] === 0x49 && bytes[1] === 0x49;
  const isBig = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!isLittle && !isBig) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint16(2, isLittle);
  if (magic !== 42) return null;

  const ifdOffset = view.getUint32(4, isLittle);
  if (ifdOffset + 2 > bytes.length) return null;

  const numEntries = view.getUint16(ifdOffset, isLittle);
  let width = 0;
  let height = 0;
  let bitsPerSample = 8;
  let samplesPerPixel = 1;
  let stripOffsets: number[] = [];
  let stripByteCounts: number[] = [];
  let rowsPerStrip = 0;
  let compression = 1;
  let photometric = 1;

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > bytes.length) break;
    const tag = view.getUint16(entryOffset, isLittle);
    const type = view.getUint16(entryOffset + 2, isLittle);
    const count = view.getUint32(entryOffset + 4, isLittle);
    const valOrOffset = view.getUint32(entryOffset + 8, isLittle);

    const getVal = () => {
      if (type === 3) return view.getUint16(entryOffset + 8, isLittle);
      return valOrOffset;
    };

    switch (tag) {
      case 256:
        width = getVal();
        break;
      case 257:
        height = getVal();
        break;
      case 258:
        bitsPerSample = getVal();
        break;
      case 259:
        compression = getVal();
        break;
      case 262:
        photometric = getVal();
        break;
      case 273: {
        if (count === 1) {
          stripOffsets = [valOrOffset];
        } else {
          stripOffsets = [];
          for (let s = 0; s < count; s++) {
            const pos = valOrOffset + s * (type === 3 ? 2 : 4);
            if (pos + 4 <= bytes.length) {
              stripOffsets.push(
                type === 3
                  ? view.getUint16(pos, isLittle)
                  : view.getUint32(pos, isLittle)
              );
            }
          }
        }
        break;
      }
      case 277:
        samplesPerPixel = getVal();
        break;
      case 278:
        rowsPerStrip = getVal();
        break;
      case 279: {
        if (count === 1) {
          stripByteCounts = [valOrOffset];
        } else {
          stripByteCounts = [];
          for (let s = 0; s < count; s++) {
            const pos = valOrOffset + s * (type === 3 ? 2 : 4);
            if (pos + 4 <= bytes.length) {
              stripByteCounts.push(
                type === 3
                  ? view.getUint16(pos, isLittle)
                  : view.getUint32(pos, isLittle)
              );
            }
          }
        }
        break;
      }
    }
  }

  if (
    width <= 0 ||
    height <= 0 ||
    compression !== 1 ||
    stripOffsets.length === 0
  ) {
    return null;
  }

  if (bitsPerSample !== 8) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  let currentY = 0;
  const rps = rowsPerStrip || height;

  for (let s = 0; s < stripOffsets.length; s++) {
    const offset = stripOffsets[s];
    const rowsInStrip = Math.min(rps, height - currentY);
    let srcIdx = offset;

    for (let r = 0; r < rowsInStrip; r++) {
      const y = currentY + r;
      for (let x = 0; x < width; x++) {
        const destIdx = (y * width + x) * 4;
        if (samplesPerPixel >= 3) {
          const red = bytes[srcIdx++] ?? 0;
          const green = bytes[srcIdx++] ?? 0;
          const blue = bytes[srcIdx++] ?? 0;
          const alpha = samplesPerPixel >= 4 ? bytes[srcIdx++] : 255;
          data[destIdx] = red;
          data[destIdx + 1] = green;
          data[destIdx + 2] = blue;
          data[destIdx + 3] = alpha;
        } else {
          let gray = bytes[srcIdx++] ?? 0;
          if (photometric === 0) gray = 255 - gray;
          data[destIdx] = gray;
          data[destIdx + 1] = gray;
          data[destIdx + 2] = gray;
          data[destIdx + 3] = 255;
        }
      }
    }
    currentY += rowsInStrip;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function readImageFile(
  input: File | { name: string; bytes: Uint8Array }
): Promise<{
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  isSvg: boolean;
}> {
  const name = input.name;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  let bytes: Uint8Array;
  let size: number;

  if (input instanceof File) {
    const buffer = await input.arrayBuffer();
    bytes = new Uint8Array(buffer);
    size = input.size;
  } else {
    bytes = input.bytes;
    size = bytes.byteLength;
  }

  let mimeType = getImageMimeType(name);
  let dataUrl = '';
  const isSvg = ext === 'svg' || ext === 'svgz';

  if (isSvg) {
    const decoder = new TextDecoder('utf-8');
    const svgText = decoder.decode(bytes);
    const encoded = encodeURIComponent(svgText)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');
    dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
  } else if (ext === 'tif' || ext === 'tiff') {
    const decoded = decodeBaselineTiff(bytes);
    if (decoded) {
      dataUrl = decoded;
      mimeType = 'image/png';
    } else {
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/tiff' });
      dataUrl = URL.createObjectURL(blob);
    }
  } else {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
        });
      };
      img.onerror = () => {
        resolve({ width: 800, height: 600 });
      };
      img.src = dataUrl;
    }
  );

  return {
    dataUrl,
    mimeType,
    width,
    height,
    size,
    isSvg,
  };
}

export async function exportImageAsPdf(
  dataUrl: string,
  fileName: string
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  let imageBytes: Uint8Array;

  if (dataUrl.startsWith('data:image/png')) {
    const base64 = dataUrl.split(',')[1];
    imageBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const embedded = await pdfDoc.embedPng(imageBytes);
    const page = pdfDoc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });
  } else {
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => {
      img.onload = r;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0);
    const pngUrl = canvas.toDataURL('image/png');
    const base64 = pngUrl.split(',')[1];
    imageBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const embedded = await pdfDoc.embedPng(imageBytes);
    const page = pdfDoc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });
  }

  pdfDoc.setTitle(fileName);
  pdfDoc.setAuthor('Minh Spark Office');
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
}
