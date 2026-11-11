import fontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import type { MediaPage } from './mediaConversion';

export async function overlayMediaPdfText(source: ArrayBuffer, pages: MediaPage[], indices: Set<number>): Promise<Blob> {
  const lib = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const pdf = await lib.PDFDocument.load(source);
  const response = await fetch(fontUrl);
  if (!response.ok) throw new Error('Không tải được phông chữ để tạo lớp chữ OCR.');
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await response.arrayBuffer(), { subset: true });
  for (const index of indices) {
    const input = pages[index];
    const page = pdf.getPage(index);
    const key = page.node.newFontDictionary(font.name, font.ref);
    const [a, b, c, d, e, f] = input.transform ?? [1, 0, 0, -1, 0, input.height];
    const determinant = a * d - b * c;
    if (!determinant) throw new Error('Không xác định được hướng trang PDF.');
    const ia = d / determinant;
    const ib = -b / determinant;
    const ic = -c / determinant;
    const id = a / determinant;
    for (const line of input.lines) {
      const text = line.text.replace(/[\u0000-\u001f]/g, ' ').trim();
      if (!text) continue;
      const size = Math.max(1, line.height * 0.82);
      const natural = font.widthOfTextAtSize(text, size);
      const squeeze = natural > 0 ? Math.max(10, Math.min(1000, line.width / natural * 100)) : 100;
      const x = line.x - e;
      const y = line.y + line.height * 0.8 - f;
      page.pushOperators(lib.pushGraphicsState(), lib.beginText(), lib.setFontAndSize(key, size), lib.setTextRenderingMode(lib.TextRenderingMode.Invisible), lib.setCharacterSqueeze(squeeze), lib.setTextMatrix(ia, ib, -ic, -id, ia * x + ic * y, ib * x + id * y), lib.showText(font.encodeText(text)), lib.endText(), lib.popGraphicsState());
    }
  }
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}
