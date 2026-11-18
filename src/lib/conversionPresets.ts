import { CONVERSION_ACCEPT, conversionSourceKind, conversionTargets } from './conversionRegistry';
import type { FileKind } from './storage';

export type FormatBadge = { text: string; light: string; dark: string };
export type ConversionPreset = { id: string; from: FileKind; to: FileKind | FormatBadge; target: string; title: string; note: string; fromBadge?: FormatBadge; sources?: readonly string[]; sourceLabel?: string };
export type ConversionPresetGroup = { title: string; presets: ConversionPreset[] };

export const SOURCE_LABEL: Record<FileKind, string> = { doc: 'Word', sheet: 'Excel', slide: 'PowerPoint', pdf: 'PDF', image: 'ảnh' };
const FORMAT_GROUPS: { kind: FileKind; label: string }[] = [
  { kind: 'doc', label: 'Văn bản' }, { kind: 'sheet', label: 'Bảng tính' },
  { kind: 'slide', label: 'Bài trình chiếu' }, { kind: 'pdf', label: 'PDF' }, { kind: 'image', label: 'Hình ảnh' },
];

function formatKind(extension: string): FileKind {
  return conversionSourceKind(`file.${extension}`) ?? 'image';
}

const accepted = CONVERSION_ACCEPT.split(',').map((suffix) => suffix.slice(1));
const targetsBySource = new Map(accepted.map((extension) => [extension, conversionTargets(`file.${extension}`)]));
const targetIds = new Set([...targetsBySource.values()].flat().map((target) => target.id));
export function conversionOutputGroups(source = '') {
  const ids = source ? (targetsBySource.get(source) ?? []).map(format => format.id) : [...targetIds];
  return FORMAT_GROUPS.map(group => ({ ...group, extensions: ids.filter(id => formatKind(id) === group.kind).sort() })).filter(group => group.extensions.length);
}
export const CONVERSION_SOURCE_GROUPS = FORMAT_GROUPS.map((group) => ({
  ...group,
  extensions: accepted.filter((extension) => formatKind(extension) === group.kind).sort(),
})).filter((group) => group.extensions.length > 0);

const preset = (from: FileKind, to: FileKind | FormatBadge, target: string, title: string, note: string): ConversionPreset => ({ id: `${from}-${target}`, from, to, target, title, note });
const badge = (text: string, light: string, dark: string): FormatBadge => ({ text, light, dark });
const narrow = (value: ConversionPreset, id: string, fromBadge: FormatBadge, sources: readonly string[], sourceLabel: string): ConversionPreset => ({ ...value, id, fromBadge, sources, sourceLabel });

const PNG = badge('PNG', '#38bdf8', '#0369d9');
const WEBP = badge('WEBP', '#34d3c4', '#0e8f84');
const TXT = badge('TXT', '#94a3b8', '#475569');
const HTML = badge('HTML', '#fb923c', '#e2450c');
const MD = badge('MD', '#64748b', '#1e293b');
const ODT = badge('ODT', '#38bdf8', '#1d62d4');
const ODS = badge('ODS', '#4ade80', '#15803d');
const RTF = badge('RTF', '#818cf8', '#4338ca');
const EPUB = badge('EPUB', '#fbbf24', '#c2410c');
const CSV = badge('CSV', '#2fd36f', '#0b8a43');
const TSV = badge('TSV', '#2dd4bf', '#0f8478');
const JSON_DATA = badge('JSON', '#fbbf24', '#c96a04');
const JPG = badge('JPG', '#fb7185', '#d3215c');
const COLORS: Record<FileKind, [string, string]> = {
  doc: ['#38bdf8', '#1d62d4'], sheet: ['#4ade80', '#15803d'], slide: ['#fb923c', '#c2410c'],
  pdf: ['#fb7185', '#b91c1c'], image: ['#60a5fa', '#4338ca'],
};
const openBadges: Record<string, FormatBadge> = {
  odt: ODT, ods: ODS, rtf: RTF, epub: EPUB, md: MD, html: HTML, txt: TXT, csv: CSV, tsv: TSV, json: JSON_DATA,
};

export const OPEN_FORMAT_GROUP = 'Định dạng mở, web và dữ liệu';
const openFormatLabels: Record<string, string> = {
  odt: 'ODT', ods: 'ODS', odp: 'ODP', ott: 'OTT', ots: 'OTS', otp: 'OTP',
  fodt: 'FODT', fods: 'FODS', fodp: 'FODP', rtf: 'RTF', epub: 'EPUB', md: 'Markdown',
  html: 'HTML', xhtml: 'XHTML', txt: 'văn bản', csv: 'CSV', tsv: 'TSV', json: 'JSON',
  xml: 'Excel XML 2003', slk: 'SYLK', dif: 'DIF', dbf: 'dBASE', numbers: 'Apple Numbers',
};
const openSources = { doc: 'docx', sheet: 'xlsx', slide: 'pptx' } as const;

function openFormatShortcuts(favorites: ConversionPreset[]) {
  const items = [...favorites];
  for (const from of Object.keys(openSources) as (keyof typeof openSources)[]) {
    const ext = openSources[from];
    const favoritesForSource = new Set(favorites.filter(item => item.from === from).map(item => item.target));
    for (const [target, label] of Object.entries(openFormatLabels)) {
      if (favoritesForSource.has(target) || !targetsBySource.get(ext)?.some(item => item.id === target)) continue;
      const title = from === 'sheet' && target === 'csv' ? 'Excel sang CSV theo trang tính' : SOURCE_LABEL[from] + ' sang ' + label;
      const icon = openBadges[target] ?? badge(target.toUpperCase(), ...COLORS[formatKind(target)]);
      const item = preset(from, icon, target, title, '.' + ext + ' → .' + target);
      items.push({ ...item, id: 'open-' + item.id });
    }
  }
  return items;
}

const shortcuts: ConversionPresetGroup[] = [
  {
    title: 'Sang PDF',
    presets: [
      preset('doc', 'pdf', 'pdf', 'Word sang PDF', '.docx → .pdf'),
      preset('sheet', 'pdf', 'pdf', 'Excel sang PDF', '.xlsx → .pdf'),
      preset('slide', 'pdf', 'pdf', 'PowerPoint sang PDF', '.pptx → .pdf'),
      preset('image', 'pdf', 'pdf', 'Ảnh sang PDF', '.jpg, .png → .pdf'),
    ],
  },
  {
    title: 'Hay dùng',
    presets: [
      narrow(preset('sheet', 'sheet', 'xlsx', 'CSV sang Excel', 'Tách cột, tạo bảng, căn cột'), 'csv-xlsx', CSV, ['csv', 'tsv'], 'CSV'),
      preset('sheet', CSV, 'csv', 'Excel sang CSV', '.xlsx → .csv'),
      narrow(preset('image', JPG, 'jpg', 'PNG sang JPG', '.png → .jpg'), 'png-jpg', PNG, ['png'], 'PNG'),
      narrow(preset('image', PNG, 'png', 'JPG sang PNG', '.jpg → .png'), 'jpg-png', JPG, ['jpg', 'jpeg', 'jfif', 'jpe'], 'JPG'),
    ],
  },
  {
    title: 'Từ PDF',
    presets: [
      preset('pdf', 'doc', 'docx', 'PDF sang Word', '.pdf → .docx'),
      preset('pdf', 'sheet', 'xlsx', 'PDF sang Excel', '.pdf → .xlsx'),
      preset('pdf', 'slide', 'pptx', 'PDF sang PowerPoint', '.pdf → .pptx'),
      preset('pdf', 'image', 'jpg', 'PDF sang JPG', '.pdf → .jpg'),
      preset('pdf', PNG, 'png', 'PDF sang PNG', '.pdf → .png'),
      preset('pdf', TXT, 'txt', 'PDF sang văn bản', '.pdf → .txt'),
      preset('pdf', HTML, 'html', 'PDF sang HTML', '.pdf → .html'),
    ],
  },
  {
    title: 'Office và OpenDocument',
    presets: [
      narrow(preset('doc', 'doc', 'docx', 'DOC sang DOCX', '.doc → .docx'), 'legacy-doc-docx', badge('DOC', '#38bdf8', '#1d62d4'), ['doc'], 'DOC'),
      narrow(preset('sheet', 'sheet', 'xlsx', 'XLS sang XLSX', '.xls → .xlsx'), 'legacy-xls-xlsx', badge('XLS', '#4ade80', '#15803d'), ['xls'], 'XLS'),
      narrow(preset('slide', 'slide', 'pptx', 'PPT sang PPTX', '.ppt → .pptx'), 'legacy-ppt-pptx', badge('PPT', '#fb923c', '#c2410c'), ['ppt'], 'PPT'),
      narrow(preset('doc', 'doc', 'docx', 'ODT sang Word', '.odt → .docx'), 'odt-docx', ODT, ['odt'], 'ODT'),
      narrow(preset('sheet', 'sheet', 'xlsx', 'ODS sang Excel', '.ods → .xlsx'), 'ods-xlsx', ODS, ['ods'], 'ODS'),
      narrow(preset('slide', 'slide', 'pptx', 'ODP sang PowerPoint', '.odp → .pptx'), 'odp-pptx', badge('ODP', '#fb923c', '#c2410c'), ['odp'], 'ODP'),
    ],
  },
  {
    title: 'Giữa Word, Excel, PowerPoint',
    presets: [
      preset('doc', 'slide', 'pptx', 'Word sang PowerPoint', '.docx → .pptx'),
      preset('slide', 'doc', 'docx', 'PowerPoint sang Word', '.pptx → .docx'),
      preset('doc', 'sheet', 'xlsx', 'Word sang Excel', 'Trích bảng → .xlsx'),
      preset('sheet', 'doc', 'docx', 'Excel sang Word', '.xlsx → .docx'),
      preset('sheet', 'slide', 'pptx', 'Excel sang PowerPoint', '.xlsx → .pptx'),
      preset('slide', 'sheet', 'xlsx', 'PowerPoint sang Excel', '.pptx → .xlsx'),
    ],
  },
  {
    title: 'Ảnh và nhận dạng chữ',
    presets: [
      preset('pdf', 'pdf', 'pdf', 'OCR PDF chỉnh sửa được', 'Giữ nền và bố cục'),
      preset('image', 'doc', 'docx', 'Ảnh sang Word', 'OCR → .docx'),
      preset('image', 'sheet', 'xlsx', 'Ảnh sang Excel', 'OCR bảng → .xlsx'),
      preset('image', 'slide', 'pptx', 'Ảnh sang PowerPoint', '.jpg, .png → .pptx'),
      preset('image', TXT, 'txt', 'Ảnh sang văn bản', 'OCR → .txt'),
      preset('doc', 'image', 'jpg', 'Word sang ảnh', '.docx → .jpg'),
      preset('sheet', 'image', 'jpg', 'Excel sang ảnh', '.xlsx → .jpg'),
      preset('slide', 'image', 'jpg', 'PowerPoint sang ảnh', '.pptx → .jpg'),
      preset('image', 'image', 'jpg', 'Ảnh sang JPG', '.png, .webp, .heic → .jpg'),
      preset('image', PNG, 'png', 'Ảnh sang PNG', '.jpg, .webp, .heic → .png'),
      preset('image', WEBP, 'webp', 'Ảnh sang WebP', '.jpg, .png → .webp'),
    ],
  },
  {
    title: OPEN_FORMAT_GROUP,
    presets: openFormatShortcuts([
      preset('doc', ODT, 'odt', 'Word sang ODT', '.docx → .odt'),
      preset('doc', RTF, 'rtf', 'Word sang RTF', '.docx → .rtf'),
      preset('doc', EPUB, 'epub', 'Word sang EPUB', 'Sách điện tử .epub'),
      preset('doc', MD, 'md', 'Word sang Markdown', '.docx → .md'),
      preset('doc', HTML, 'html', 'Word sang HTML', '.docx → .html'),
      preset('doc', TXT, 'txt', 'Word sang văn bản', '.docx → .txt'),
      preset('sheet', ODS, 'ods', 'Excel sang ODS', '.xlsx → .ods'),
      preset('sheet', TSV, 'tsv', 'Excel sang TSV', '.xlsx → .tsv'),
      preset('sheet', JSON_DATA, 'json', 'Excel sang JSON', '.xlsx → .json'),
      preset('sheet', HTML, 'html', 'Excel sang HTML', '.xlsx → .html'),
      preset('slide', ODT, 'odt', 'PowerPoint sang ODT', '.pptx → .odt'),
      preset('slide', MD, 'md', 'PowerPoint sang Markdown', '.pptx → .md'),
      preset('slide', HTML, 'html', 'PowerPoint sang HTML', '.pptx → .html'),
    ]),
  },
];

function presetSources(value: ConversionPreset): string[] {
  const sources = value.sources ?? CONVERSION_SOURCE_GROUPS.find((group) => group.kind === value.from)?.extensions ?? [];
  return sources.filter((ext) => targetsBySource.get(ext)?.some((format) => format.id === value.target));
}

export const CONVERSION_PRESET_GROUPS = shortcuts.map((group) => ({
  ...group, presets: group.presets.filter((value) => presetSources(value).length > 0),
})).filter((group) => group.presets.length > 0);
export const CONVERSION_PRESETS = CONVERSION_PRESET_GROUPS.flatMap((group) => group.presets);

const PRIMARY: Partial<Record<FileKind, string>> = { doc: 'docx', sheet: 'xlsx', slide: 'pptx', pdf: 'pdf' };

function exactPresets(source: string): ConversionPreset[] {
  const from = formatKind(source);
  return (targetsBySource.get(source) ?? []).map((item) => {
    const to = formatKind(item.id);
    return {
      id: `format-${source}-${item.id}`, from, sources: [source], sourceLabel: source.toUpperCase(),
      fromBadge: PRIMARY[from] === source ? undefined : badge(source.toUpperCase(), ...COLORS[from]),
      to: PRIMARY[to] === item.id ? to : badge(item.id.toUpperCase(), ...COLORS[to]),
      target: item.id, title: `${source.toUpperCase()} → ${item.id.toUpperCase()}`, note: item.label,
    };
  });
}

function searchable(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd');
}

export function filterConversionPresets(query: string, selectedSource = '', selectedTarget = ''): ConversionPresetGroup[] {
  const normalized = searchable(query).trim();
  if (selectedTarget) {
    const words = normalized.split(/[^a-z0-9]+/).filter(word => word && !['to', 'sang', 'qua'].includes(word));
    return CONVERSION_SOURCE_GROUPS.map(group => ({
      title: group.label,
      presets: group.extensions.filter(ext => !selectedSource || ext === selectedSource).flatMap(ext =>
        exactPresets(ext).filter(route => route.target === selectedTarget && words.every(word =>
          searchable([ext, group.label, SOURCE_LABEL[group.kind], route.target, route.note].join(' ')).includes(word)))),
    })).filter(group => group.presets.length);
  }
  const direction = normalized.match(/^(.*?)\s*(?:→|->|\bto\b|\bsang\b|\bqua\b)\s*(.*?)$/);
  const aliases: Record<string, string> = { word: 'docx', excel: 'xlsx', powerpoint: 'pptx' };
  const destination = direction?.[2].replace(/^\./, '') ?? '';
  const targetId = aliases[destination] ?? destination;
  if (!selectedSource && direction && targetIds.has(targetId)) {
    const prefix = direction[1].replace(/^\./, '');
    const families: Record<string, FileKind> = { word: 'doc', excel: 'sheet', powerpoint: 'slide', anh: 'image', image: 'image' };
    if (!prefix || accepted.includes(prefix) || families[prefix]) {
      return CONVERSION_SOURCE_GROUPS.map((group) => ({
        title: group.label,
        presets: group.extensions.filter((ext) => !prefix || prefix === ext || families[prefix] === group.kind)
          .flatMap((ext) => exactPresets(ext).filter((route) => route.target === targetId)),
      })).filter((group) => group.presets.length > 0);
    }
  }
  const terms = normalized.split(/[^a-z0-9]+/).filter((word) => word && !['to', 'sang', 'qua'].includes(word));
  const source = selectedSource || (accepted.includes(terms[0]) ? terms[0] : '');
  if (source) {
    const requested = terms[0] === source && (!selectedSource || direction) ? terms.slice(1) : terms;
    const routes = exactPresets(source);
    const target = aliases[requested.join(' ')] ?? requested.join(' ');
    const presets = targetIds.has(target) || accepted.includes(target) ? routes.filter((item) => item.target === target) : routes.filter((item) => {
      const haystack = `${item.target} ${searchable(item.note)}`;
      return requested.every((term) => haystack.includes(term));
    });
    return FORMAT_GROUPS.map((group) => ({
      title: group.label, presets: presets.filter((item) => formatKind(item.target) === group.kind),
    })).filter((group) => group.presets.length > 0);
  }
  if (!terms.length) return CONVERSION_PRESET_GROUPS;
  return CONVERSION_PRESET_GROUPS.map((group) => ({
    ...group,
    presets: group.presets.filter((item) => {
      const candidates = [item.title, item.note, ...presetSources(item).map((ext) => `${ext} ${item.target}`)];
      return candidates.some((candidate) => {
        const phrase = searchable(candidate);
        let start = 0;
        for (const term of terms) {
          const index = phrase.indexOf(term, start);
          if (index === -1) return false;
          start = index + term.length;
        }
        return true;
      });
    }),
  })).filter((group) => group.presets.length > 0);
}

export const presetSourceLabel = (value: ConversionPreset) => value.sourceLabel ?? SOURCE_LABEL[value.from];

export function presetInitialFidelity(value?: ConversionPreset) {
  if (!value) return 'layout';
  if (value.from === 'image' && value.target === 'docx') return 'editable';
  if (['doc', 'slide'].includes(value.from) && ['xlsx', 'ods', 'fods', 'ots'].includes(value.target)) return 'editable';
  if (['sheet', 'slide'].includes(value.from) && ['odt', 'fodt', 'ott', 'rtf'].includes(value.target)) return 'editable';
  return 'layout';
}

export function presetAccept(value: ConversionPreset) {
  return presetSources(value).map((extension) => `.${extension}`).join(',');
}

export function presetAcceptsFile(value: ConversionPreset, fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return fileName.includes('.') && presetSources(value).includes(extension);
}

export function presetSampleName(value: ConversionPreset) {
  const sources = presetSources(value);
  const first = value.from === 'image' ? 'png' : PRIMARY[value.from];
  return `sample.${first && sources.includes(first) ? first : sources[0]}`;
}
