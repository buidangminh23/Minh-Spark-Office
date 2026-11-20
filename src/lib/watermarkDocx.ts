import type JSZip from 'jszip';
import {
  clampOpacity,
  decodeDataUrl,
  encodeDataUrl,
  estimateTextWidth,
  fitBox,
  imageSize,
  normalizeWatermark,
  watermarkColorHex,
  xmlEscape,
  WATERMARK_ANGLE,
  type WatermarkSpec,
} from './watermark';

const PX_TO_PT = 0.75;
const DOC_DEFAULT_COLOR = '#0f172a';
const DOC_DEFAULT_OPACITY = 0.15;

type DocPageWatermark = { watermark?: string; watermarkOptions?: Partial<WatermarkSpec> };

export function docWatermarkSpec(page: DocPageWatermark): WatermarkSpec | null {
  const options = page.watermarkOptions ?? {};
  if (options.kind === 'image') return normalizeWatermark({ ...options, kind: 'image' });
  return normalizeWatermark({
    font: 'Arial',
    size: 64,
    ...options,
    kind: 'text',
    text: page.watermark,
    color: options.color ?? DOC_DEFAULT_COLOR,
    opacity: options.opacity ?? DOC_DEFAULT_OPACITY,
  });
}
const TEXT_SHAPE_ID = 'PowerPlusWaterMarkObject';
const IMAGE_SHAPE_ID = 'WordPictureWatermark';
const IMAGE_REL_ID = 'rIdMinhWatermark';
const POSITION = 'z-index:-251657216;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin';
const GAIN_UNIT = 65536;

const TEXT_SHAPETYPE = '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>';
const IMAGE_SHAPETYPE = '<v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/><v:formulas><v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/><v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/><v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/></v:formulas><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype>';

const rotationStyle = (spec: WatermarkSpec) => (spec.layout === 'horizontal' ? '' : `rotation:${360 - WATERMARK_ANGLE};`);

function textShapeXml(spec: WatermarkSpec, contentWidthPx: number) {
  const text = spec.text ?? '';
  const sizePx = spec.size ?? 64;
  const naturalWidth = estimateTextWidth(text, sizePx);
  const scale = Math.min(1, (contentWidthPx * 0.95) / Math.max(1, naturalWidth));
  const width = (naturalWidth * scale * PX_TO_PT).toFixed(1);
  const height = (sizePx * scale * PX_TO_PT).toFixed(1);
  const font = xmlEscape(spec.font ?? 'Arial');
  return `${TEXT_SHAPETYPE}<v:shape id="${TEXT_SHAPE_ID}1" o:spid="_x0000_s2049" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:${width}pt;height:${height}pt;${rotationStyle(spec)}${POSITION}" o:allowincell="f" fillcolor="#${watermarkColorHex(spec.color)}" stroked="f"><v:fill opacity="${clampOpacity(spec.opacity).toFixed(2)}"/><v:textpath style="font-family:&quot;${font}&quot;;font-size:1pt" string="${xmlEscape(text)}"/><w10:wrap anchorx="margin" anchory="margin"/></v:shape>`;
}

function imageShapeXml(spec: WatermarkSpec, contentWidthPx: number, size: { width: number; height: number } | null) {
  const box = fitBox(size?.width ?? 400, size?.height ?? 300, contentWidthPx * 0.7, contentWidthPx * 0.7);
  const opacity = clampOpacity(spec.opacity);
  const gain = Math.round(opacity * GAIN_UNIT);
  const black = Math.round((1 - opacity) * 0.5 * GAIN_UNIT);
  return `${IMAGE_SHAPETYPE}<v:shape id="${IMAGE_SHAPE_ID}1" o:spid="_x0000_s2050" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${(box.width * PX_TO_PT).toFixed(1)}pt;height:${(box.height * PX_TO_PT).toFixed(1)}pt;${rotationStyle(spec)}${POSITION}" o:allowincell="f"><v:imagedata r:id="${IMAGE_REL_ID}" o:title="" gain="${gain}f" blacklevel="${black}f"/><w10:wrap anchorx="margin" anchory="margin"/></v:shape>`;
}

const insertRun = (xml: string, run: string) => {
  const close = xml.indexOf('</w:p>');
  if (close >= 0) return `${xml.slice(0, close)}${run}${xml.slice(close)}`;
  return xml.replace('</w:hdr>', `<w:p>${run}</w:p></w:hdr>`);
};

async function addImageRelationship(zip: JSZip, headerPath: string, target: string) {
  const relsPath = headerPath.replace(/^word\//, 'word/_rels/') + '.rels';
  const existing = await zip.file(relsPath)?.async('string');
  const rel = `<Relationship Id="${IMAGE_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
  const next = existing
    ? existing.includes(`Id="${IMAGE_REL_ID}"`) ? existing : /<Relationships[^>]*\/>/.test(existing) ? existing.replace(/<Relationships([^>]*)\/>/, `<Relationships$1>${rel}</Relationships>`) : existing.replace('</Relationships>', `${rel}</Relationships>`)
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`;
  zip.file(relsPath, next);
}

async function ensureContentType(zip: JSZip, ext: string, mime: string) {
  const file = zip.file('[Content_Types].xml');
  const xml = await file?.async('string');
  if (!xml || new RegExp(`Extension="${ext}"`, 'i').test(xml)) return;
  zip.file('[Content_Types].xml', xml.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`));
}

export async function injectDocxWatermark(zip: JSZip, input: Partial<WatermarkSpec> | null | undefined, contentWidthPx: number) {
  const spec = normalizeWatermark(input);
  if (!spec) return false;
  const headers = Object.keys(zip.files).filter((path) => /^word\/header\d*\.xml$/.test(path));
  if (!headers.length) return false;
  let picture = '';
  let size: { width: number; height: number } | null = null;
  if (spec.kind === 'image') {
    const image = decodeDataUrl(spec.image);
    if (!image) return false;
    const name = `media/minh-watermark.${image.ext}`;
    zip.file(`word/${name}`, image.bytes);
    await ensureContentType(zip, image.ext, image.mime);
    size = imageSize(image.bytes);
    picture = name;
  }
  for (const path of headers) {
    const xml = await zip.file(path)!.async('string');
    if (xml.includes(TEXT_SHAPE_ID) || xml.includes(IMAGE_SHAPE_ID)) continue;
    const shape = spec.kind === 'image' ? imageShapeXml(spec, contentWidthPx, size) : textShapeXml(spec, contentWidthPx);
    zip.file(path, insertRun(xml, `<w:r><w:rPr><w:noProof/></w:rPr><w:pict>${shape}</w:pict></w:r>`));
    if (picture) await addImageRelationship(zip, path, picture);
  }
  return true;
}

const attrOf = (tag: string, name: string) => {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
};

const xmlUnescape = (text: string) =>
  text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const layoutFromStyle = (style: string) => {
  const rotation = /rotation:\s*(-?[\d.]+)/.exec(style);
  return rotation && Math.abs(Number(rotation[1]) % 360) > 1 ? 'diagonal' : 'horizontal';
};

export type ParsedDocxWatermark = { watermark: string; watermarkOptions: Omit<WatermarkSpec, 'text'> };

export function parseTextWatermark(xml: string): ParsedDocxWatermark | null {
  const shape = /<v:shape\b[^>]*id="[^"]*PowerPlusWaterMarkObject[^"]*"[^>]*>([\s\S]*?)<\/v:shape>/.exec(xml);
  if (!shape) return null;
  const open = /<v:shape\b[^>]*>/.exec(shape[0])![0];
  const textpath = /<v:textpath\b[^>]*>/.exec(shape[1])?.[0] ?? '';
  const text = xmlUnescape(attrOf(textpath, 'string') ?? '').trim();
  if (!text) return null;
  const fill = /<v:fill\b[^>]*>/.exec(shape[1])?.[0] ?? '';
  const opacity = Number(attrOf(fill, 'opacity') ?? '0.5');
  const font = /font-family:\s*(?:&quot;|")?([^;&"]+)/.exec(xmlUnescape(attrOf(textpath, 'style') ?? ''))?.[1]?.trim();
  const fillColor = attrOf(open, 'fillcolor') ?? '';
  const color = /^#?[0-9a-f]{6}$/i.test(fillColor) ? `#${fillColor.replace('#', '')}` : fillColor === 'silver' ? '#c0c0c0' : '#c0c0c0';
  const style = attrOf(open, 'style') ?? '';
  const height = /height:\s*([\d.]+)pt/.exec(style);
  const size = height ? Math.round(Number(height[1]) / PX_TO_PT) : 64;
  return {
    watermark: text,
    watermarkOptions: { kind: 'text', color, opacity: clampOpacity(Number.isFinite(opacity) ? opacity : 0.5), font: font || 'Arial', size: Math.min(200, Math.max(16, size)), layout: layoutFromStyle(style) },
  };
}

export async function readDocxWatermark(zip: JSZip, headerPath: string): Promise<ParsedDocxWatermark | null> {
  const xml = await zip.file(headerPath)?.async('string');
  if (!xml) return null;
  const text = parseTextWatermark(xml);
  if (text) return text;
  const shape = /<v:shape\b[^>]*id="[^"]*WordPictureWatermark[^"]*"[^>]*>([\s\S]*?)<\/v:shape>/.exec(xml);
  if (!shape) return null;
  const imagedata = /<v:imagedata\b[^>]*>/.exec(shape[1])?.[0] ?? '';
  const relId = attrOf(imagedata, 'r:id');
  if (!relId) return null;
  const rels = await zip.file(headerPath.replace(/^word\//, 'word/_rels/') + '.rels')?.async('string');
  const rel = rels ? new RegExp(`<Relationship\\b[^>]*Id="${relId}"[^>]*>`).exec(rels)?.[0] : undefined;
  const target = rel ? attrOf(rel, 'Target') : null;
  if (!target) return null;
  const path = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`;
  const bytes = await zip.file(path)?.async('uint8array');
  if (!bytes) return null;
  const ext = path.split('.').pop()?.toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
  const gain = attrOf(imagedata, 'gain');
  const opacity = gain ? Number(gain.replace(/f$/, '')) / GAIN_UNIT : 0.3;
  const open = /<v:shape\b[^>]*>/.exec(shape[0])![0];
  return {
    watermark: '',
    watermarkOptions: { kind: 'image', image: encodeDataUrl(bytes, mime), opacity: clampOpacity(opacity), layout: layoutFromStyle(attrOf(open, 'style') ?? '') },
  };
}
