import {
  PDFDocument, TextRenderingMode, beginText, endText, popGraphicsState, pushGraphicsState,
  setCharacterSqueeze, setFontAndSize, setTextMatrix, setTextRenderingMode, showText,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { loadEditablePdfFont, type PdfOcrFontLoader } from './pdfOcrDocument';
import { cleanPdfText } from './conversionTypes';

export type SearchableLine = { text: string; x: number; y: number; width: number; height: number };
export type SearchablePage = { pageIndex: number; transform: number[]; lines: SearchableLine[] };

const FONT_SIZE_RATIO = 0.82;
const BASELINE_RATIO = 0.8;
const SQUEEZE_MIN = 20;
const SQUEEZE_MAX = 300;
const IDENTITY = [1, 0, 0, -1, 0, 0];

export async function addSearchableLayer(source: ArrayBuffer | Uint8Array, pages: SearchablePage[], fontLoader: PdfOcrFontLoader = loadEditablePdfFont): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source, { updateMetadata: false });
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await fontLoader('sans', false), { subset: true });
  const glyphs = new Set(font.getCharacterSet());
  for (const entry of pages) {
    if (!Number.isInteger(entry.pageIndex) || entry.pageIndex < 0 || entry.pageIndex >= doc.getPageCount()) continue;
    const page = doc.getPage(entry.pageIndex);
    const [a, b, c, d, e, f] = entry.transform.length === 6 ? entry.transform : [...IDENTITY.slice(0, 5), page.getHeight()];
    const det = a * d - b * c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) continue;
    const zoom = Math.sqrt(Math.abs(det));
    page.node.normalize();
    const key = page.node.newFontDictionary(font.name, font.ref);
    for (const line of entry.lines) {
      const text = [...cleanPdfText(line.text)].filter((character) => glyphs.has(character.codePointAt(0)!)).join('').trim();
      if (!text || !(line.width > 0) || !(line.height > 0)) continue;
      const size = line.height * FONT_SIZE_RATIO / zoom;
      const natural = font.widthOfTextAtSize(text, size);
      const squeeze = natural > 0 ? Math.min(SQUEEZE_MAX, Math.max(SQUEEZE_MIN, (line.width / zoom / natural) * 100)) : 100;
      const vx = line.x - e;
      const vy = line.y + line.height * BASELINE_RATIO - f;
      page.pushOperators(
        pushGraphicsState(), beginText(), setFontAndSize(key, size), setTextRenderingMode(TextRenderingMode.Invisible), setCharacterSqueeze(squeeze),
        setTextMatrix(d / det * zoom, -b / det * zoom, c / det * zoom, -a / det * zoom, (d * vx - c * vy) / det, (a * vy - b * vx) / det),
        showText(font.encodeText(text)), endText(), popGraphicsState(),
      );
    }
  }
  return doc.save();
}
