import JSZip from 'jszip';
import fontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import type { LinkRun, PageImage, TextRun } from '../editors/doc/pageRender';
import type { PageSettings } from './storage';

const PT_PER_PX = 0.75;
const BASELINE_RATIO = 0.8;
const FONT_SIZE_RATIO = 0.82;
const SQUEEZE_MIN = 20;
const SQUEEZE_MAX = 300;
const XPS_UNITS_PER_PX = 1;

export async function buildPdf(input: { pages: PageImage[]; runs: TextRun[]; links: LinkRun[]; title: string; page: PageSettings }): Promise<Blob> {
  const lib = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const pdf = await lib.PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = input.runs.length ? await pdf.embedFont(await (await fetch(fontUrl)).arrayBuffer(), { subset: true }) : null;
  const properties = input.page.properties;
  pdf.setTitle(input.title);
  pdf.setAuthor(properties?.author || 'Minh Spark');
  pdf.setCreator('Minh Docs');
  pdf.setProducer('Minh Docs');
  pdf.setLanguage(input.page.language ?? 'vi');
  if (properties?.subject) pdf.setSubject(properties.subject);
  if (properties?.keywords) pdf.setKeywords(properties.keywords.split(/[,;]/).map((word) => word.trim()).filter(Boolean));
  for (const [index, image] of input.pages.entries()) {
    const width = image.cssWidth * PT_PER_PX;
    const height = image.cssHeight * PT_PER_PX;
    const page = pdf.addPage([width, height]);
    const bytes = await image.blob.arrayBuffer();
    const embedded = image.mime === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    page.drawImage(embedded, { x: 0, y: 0, width, height });
    if (font) {
      const key = page.node.newFontDictionary(font.name, font.ref);
      for (const run of input.runs) {
        if (run.page !== index || !run.text.trim()) continue;
        const size = run.h * PT_PER_PX * FONT_SIZE_RATIO;
        const natural = font.widthOfTextAtSize(run.text, size);
        const squeeze = natural > 0 ? Math.min(SQUEEZE_MAX, Math.max(SQUEEZE_MIN, ((run.w * PT_PER_PX) / natural) * 100)) : 100;
        const baseline = height - (run.y + run.h * BASELINE_RATIO) * PT_PER_PX;
        page.pushOperators(
          lib.pushGraphicsState(),
          lib.beginText(),
          lib.setFontAndSize(key, size),
          lib.setTextRenderingMode(lib.TextRenderingMode.Invisible),
          lib.setCharacterSqueeze(squeeze),
          lib.setTextMatrix(1, 0, 0, 1, run.x * PT_PER_PX, baseline),
          lib.showText(font.encodeText(run.text)),
          lib.endText(),
          lib.popGraphicsState(),
        );
      }
    }
    for (const link of input.links) {
      if (link.page !== index) continue;
      const annotation = pdf.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [link.x * PT_PER_PX, height - (link.y + link.h) * PT_PER_PX, (link.x + link.w) * PT_PER_PX, height - link.y * PT_PER_PX],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: lib.PDFString.of(link.href) },
      });
      page.node.addAnnot(pdf.context.register(annotation));
    }
  }
  return new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' });
}

const XPS_FIXED = 'http://schemas.microsoft.com/xps/2005/06';
const XPS_REL = 'http://schemas.microsoft.com/xps/2005/06';

export async function buildXps(pages: PageImage[]): Promise<Blob> {
  const zip = new JSZip();
  const images = pages.map((image, i) => `/Documents/1/Resources/Images/${i + 1}.${image.mime === 'image/png' ? 'png' : 'jpeg'}`);
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="fdseq" ContentType="application/vnd.ms-package.xps-fixeddocumentsequence+xml"/><Default Extension="fdoc" ContentType="application/vnd.ms-package.xps-fixeddocument+xml"/><Default Extension="fpage" ContentType="application/vnd.ms-package.xps-fixedpage+xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="R1" Type="${XPS_REL}/fixedrepresentation" Target="/FixedDocSeq.fdseq"/></Relationships>`);
  zip.file('FixedDocSeq.fdseq', `<FixedDocumentSequence xmlns="${XPS_FIXED}"><DocumentReference Source="/Documents/1/FixedDoc.fdoc"/></FixedDocumentSequence>`);
  zip.file('Documents/1/FixedDoc.fdoc', `<FixedDocument xmlns="${XPS_FIXED}">${pages.map((_, i) => `<PageContent Source="/Documents/1/Pages/${i + 1}.fpage"/>`).join('')}</FixedDocument>`);
  for (const [i, image] of pages.entries()) {
    const width = image.cssWidth * XPS_UNITS_PER_PX;
    const height = image.cssHeight * XPS_UNITS_PER_PX;
    zip.file(images[i].slice(1), await image.blob.arrayBuffer());
    zip.file(`Documents/1/Pages/${i + 1}.fpage`, `<FixedPage xmlns="${XPS_FIXED}" xml:lang="vi-VN" Width="${width}" Height="${height}"><Path Data="M0,0 L${width},0 ${width},${height} 0,${height} Z"><Path.Fill><ImageBrush ImageSource="${images[i]}" Viewbox="0,0,${image.pixelWidth},${image.pixelHeight}" ViewboxUnits="Absolute" Viewport="0,0,${width},${height}" ViewportUnits="Absolute" TileMode="None"/></Path.Fill></Path></FixedPage>`);
    zip.file(`Documents/1/Pages/_rels/${i + 1}.fpage.rels`, `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="R1" Type="${XPS_REL}/required-resource" Target="${images[i]}"/></Relationships>`);
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/oxps' });
}

export const pagesAsFiles = (pages: PageImage[], base: string, extension: string) => pages.map((page, i) => ({
  name: pages.length === 1 ? `${base}.${extension}` : `${base} - trang ${String(i + 1).padStart(String(pages.length).length, '0')}.${extension}`,
  blob: page.blob,
}));

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.blob);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' });
}
