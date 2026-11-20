import type JSZip from 'jszip';
import { clampOpacity, decodeDataUrl, watermarkColorHex, WATERMARK_ANGLE, type WatermarkSpec } from './watermark';

const MEDIA_PATH = 'xl/media/minh-watermark.png';
const VML_PATH = 'xl/drawings/vmlDrawingMinhWatermark.vml';
const SHEET_REL_ID = 'rIdMinhWatermarkHF';
const VML_REL_ID = 'rIdMinhWatermarkImg';
const PX_TO_PT = 0.75;
const HEADER_AFTER = ['rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];
const LEGACY_AFTER = ['picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 1200;

export type WatermarkPicture = { bytes: Uint8Array; width: number; height: number };

const insertBefore = (xml: string, tags: string[], fragment: string) => {
  let index = -1;
  for (const tag of tags) {
    const match = new RegExp(`<${tag}[\\s/>]`).exec(xml);
    if (match && (index < 0 || match.index < index)) index = match.index;
  }
  if (index < 0) index = xml.lastIndexOf('</worksheet>');
  return `${xml.slice(0, index)}${fragment}${xml.slice(index)}`;
};

const withHeader = (xml: string) => {
  if (/<headerFooter\b[^>]*\/>/.test(xml)) return xml.replace(/<headerFooter\b([^>]*)\/>/, '<headerFooter$1><oddHeader>&amp;C&amp;G</oddHeader></headerFooter>');
  if (/<headerFooter\b/.test(xml)) {
    if (/<oddHeader>/.test(xml)) return xml.replace(/<oddHeader>([\s\S]*?)<\/oddHeader>/, (_all, inner: string) => `<oddHeader>${inner.replace(/&amp;C[^&]*/, '')}&amp;C&amp;G</oddHeader>`);
    return xml.replace(/<headerFooter\b([^>]*)>/, '<headerFooter$1><oddHeader>&amp;C&amp;G</oddHeader>');
  }
  return insertBefore(xml, HEADER_AFTER, '<headerFooter><oddHeader>&amp;C&amp;G</oddHeader></headerFooter>');
};

const ensureRelNamespace = (xml: string) =>
  /xmlns:r=/.test(xml) ? xml : xml.replace(/<worksheet\b/, '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');

const vmlXml = (picture: WatermarkPicture) => {
  const width = (picture.width * PX_TO_PT).toFixed(1);
  const height = (picture.height * PX_TO_PT).toFixed(1);
  return `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/><v:formulas><v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/><v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/><v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/></v:formulas><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype><v:shape id="CH" o:spid="_x0000_s1025" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${width}pt;height:${height}pt;z-index:1"><v:imagedata o:relid="${VML_REL_ID}" o:title="MinhWatermark"/><o:lock v:ext="edit" rotation="t"/></v:shape></xml>`;
};

async function addRel(zip: JSZip, relsPath: string, id: string, type: string, target: string) {
  const existing = await zip.file(relsPath)?.async('string');
  const rel = `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
  if (existing?.includes(`Id="${id}"`)) return;
  const next = !existing
    ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`
    : /<Relationships\b[^>]*\/>/.test(existing)
      ? existing.replace(/<Relationships\b([^>]*)\/>/, `<Relationships$1>${rel}</Relationships>`)
      : existing.replace('</Relationships>', `${rel}</Relationships>`);
  zip.file(relsPath, next);
}

async function ensureDefault(zip: JSZip, ext: string, mime: string) {
  const xml = await zip.file('[Content_Types].xml')?.async('string');
  if (!xml || new RegExp(`Extension="${ext}"`, 'i').test(xml)) return;
  zip.file('[Content_Types].xml', xml.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`));
}

export async function injectXlsxWatermark(zip: JSZip, picture: WatermarkPicture) {
  const sheets = Object.keys(zip.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
  if (!sheets.length) return false;
  zip.file(MEDIA_PATH, picture.bytes);
  zip.file(VML_PATH, vmlXml(picture));
  await addRel(zip, 'xl/drawings/_rels/vmlDrawingMinhWatermark.vml.rels', VML_REL_ID, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', '../media/minh-watermark.png');
  await ensureDefault(zip, 'png', 'image/png');
  await ensureDefault(zip, 'vml', 'application/vnd.openxmlformats-officedocument.vmlDrawing');
  for (const path of sheets) {
    let xml = await zip.file(path)!.async('string');
    if (xml.includes(SHEET_REL_ID)) continue;
    xml = ensureRelNamespace(withHeader(xml.replace(/<legacyDrawingHF\b[^>]*\/>/g, '')));
    xml = insertBefore(xml, LEGACY_AFTER, `<legacyDrawingHF r:id="${SHEET_REL_ID}"/>`);
    zip.file(path, xml);
    await addRel(zip, path.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels', SHEET_REL_ID, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing', '../drawings/vmlDrawingMinhWatermark.vml');
  }
  return true;
}

export async function addXlsxWatermark(blob: Blob, picture: WatermarkPicture): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  if (!(await injectXlsxWatermark(zip, picture))) return blob;
  return zip.generateAsync({ type: 'blob', mimeType: blob.type, compression: 'DEFLATE' });
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Không đọc được ảnh hình mờ'));
  image.src = src;
});

export async function renderWatermarkPicture(spec: WatermarkSpec): Promise<WatermarkPicture | null> {
  if (spec.kind === 'image' && !decodeDataUrl(spec.image)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  if (spec.layout !== 'horizontal') ctx.rotate((-WATERMARK_ANGLE * Math.PI) / 180);
  ctx.globalAlpha = clampOpacity(spec.opacity);
  if (spec.kind === 'image') {
    const image = await loadImage(spec.image!);
    const scale = Math.min((CANVAS_WIDTH * 0.75) / image.width, (CANVAS_HEIGHT * 0.6) / image.height);
    ctx.drawImage(image, (-image.width * scale) / 2, (-image.height * scale) / 2, image.width * scale, image.height * scale);
  } else {
    let size = (spec.size ?? 64) * 2;
    ctx.font = `800 ${size}px "${spec.font ?? 'Arial'}", Arial, sans-serif`;
    const limit = CANVAS_WIDTH * 1.05;
    const measured = ctx.measureText(spec.text ?? '').width;
    if (measured > limit) {
      size *= limit / measured;
      ctx.font = `800 ${size}px "${spec.font ?? 'Arial'}", Arial, sans-serif`;
    }
    ctx.fillStyle = `#${watermarkColorHex(spec.color)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.text ?? '', 0, 0);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: CANVAS_WIDTH / 2, height: CANVAS_HEIGHT / 2 };
}
