export type VbaFormControlType =
  | 'label'
  | 'textbox'
  | 'combobox'
  | 'listbox'
  | 'checkbox'
  | 'optionbutton'
  | 'togglebutton'
  | 'commandbutton'
  | 'frame'
  | 'image'
  | 'spinbutton'
  | 'scrollbar'
  | 'multipage'
  | 'tabstrip'
  | 'unknown';

export interface VbaFormFont {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface VbaFormControlDef {
  name: string;
  type: VbaFormControlType;
  left: number;
  top: number;
  width: number;
  height: number;
  caption?: string;
  value?: string;
  tag?: string;
  tip?: string;
  rowSource?: string;
  controlSource?: string;
  groupName?: string;
  visible: boolean;
  enabled: boolean;
  locked?: boolean;
  multiLine?: boolean;
  passwordChar?: string;
  isDefault?: boolean;
  isCancel?: boolean;
  tabIndex: number;
  foreColor?: number;
  backColor?: number;
  font?: VbaFormFont;
  textAlign?: number;
  children?: VbaFormControlDef[];
}

export interface VbaUserFormDef {
  name: string;
  caption: string;
  width: number;
  height: number;
  backColor?: number;
  startUpPosition?: number;
  controls: VbaFormControlDef[];
}

export type FormStreamReader = (path: string) => Uint8Array | null;

const HIMETRIC_PER_POINT = 2540 / 72;
const SITE_VISIBLE = 0x2;
const SITE_DEFAULT = 0x4;
const SITE_CANCEL = 0x8;
const SITE_DEFAULT_FLAGS = 0x33;
const FORM_DONT_SAVE_CLASS_TABLE = 1 << 15;

const toPoints = (value: number) => Math.round((value / HIMETRIC_PER_POINT) * 20) / 20;

const CLSID_TYPES: Record<number, VbaFormControlType> = {
  7: 'frame',
  12: 'image',
  14: 'frame',
  15: 'textbox',
  16: 'spinbutton',
  17: 'commandbutton',
  18: 'tabstrip',
  21: 'label',
  23: 'textbox',
  24: 'listbox',
  25: 'combobox',
  26: 'checkbox',
  27: 'optionbutton',
  28: 'togglebutton',
  47: 'scrollbar',
  57: 'multipage',
};

const DISPLAY_STYLES: Record<number, VbaFormControlType> = { 1: 'textbox', 2: 'listbox', 3: 'combobox', 4: 'checkbox', 5: 'optionbutton', 6: 'togglebutton', 7: 'combobox' };

type Field = [bit: number, size: 1 | 2 | 4, key: string];

class Reader {
  readonly bytes: Uint8Array;
  pos: number;
  private readonly view: DataView;
  constructor(bytes: Uint8Array, pos = 0) {
    this.bytes = bytes;
    this.pos = pos;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  get remaining() {
    return this.bytes.length - this.pos;
  }
  u8() {
    const value = this.view.getUint8(this.pos);
    this.pos += 1;
    return value;
  }
  u16() {
    const value = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return value;
  }
  u32() {
    const value = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return value;
  }
  i32() {
    const value = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return value;
  }
  align(size: number, base: number) {
    const offset = (this.pos - base) % size;
    if (offset) this.pos += size - offset;
  }
  skip(count: number) {
    this.pos += count;
  }
}

const hasBit = (mask: bigint, bit: number) => ((mask >> BigInt(bit)) & 1n) === 1n;

function readBlock(reader: Reader, mask: bigint, fields: Field[], base: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [bit, size, key] of fields) {
    if (!hasBit(mask, bit)) continue;
    reader.align(size, base);
    out[key] = size === 1 ? reader.u8() : size === 2 ? reader.u16() : reader.u32();
  }
  reader.align(4, base);
  return out;
}

function decodeString(bytes: Uint8Array, compressed: boolean, codePage: number): string {
  if (!compressed) return new TextDecoder('utf-16le').decode(bytes);
  const label = codePage === 65001 ? 'utf-8' : `windows-${codePage}`;
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return String.fromCharCode(...bytes);
  }
}

function readString(reader: Reader, count: number | undefined, base: number, codePage: number): string | undefined {
  if (count === undefined) return undefined;
  const length = count & 0x7fffffff;
  const bytes = reader.bytes.subarray(reader.pos, reader.pos + length);
  reader.skip(length);
  reader.align(4, base);
  return decodeString(bytes, (count & 0x80000000) !== 0, codePage);
}

function readSize(reader: Reader, present: boolean, base: number): { width: number; height: number } | null {
  if (!present) return null;
  reader.align(4, base);
  return { width: toPoints(reader.i32()), height: toPoints(reader.i32()) };
}

function skipPicture(reader: Reader) {
  reader.skip(16);
  reader.skip(4);
  reader.skip(reader.u32());
}

function readTextProps(reader: Reader, codePage: number): { font: VbaFormFont; textAlign?: number } {
  if (reader.remaining < 4) return { font: {} };
  const start = reader.pos;
  reader.skip(2);
  const size = reader.u16();
  const end = reader.pos + size;
  const mask = BigInt(reader.u32());
  const block = readBlock(reader, mask, [
    [0, 4, 'name'],
    [1, 4, 'effects'],
    [2, 4, 'height'],
    [4, 1, 'charset'],
    [5, 1, 'pitch'],
    [6, 1, 'align'],
    [7, 2, 'weight'],
  ], start);
  const name = readString(reader, block.name, start, codePage);
  reader.pos = end;
  const effects = block.effects ?? 0;
  return {
    font: {
      name,
      size: block.height ? Math.round((block.height / 20) * 100) / 100 : undefined,
      bold: (effects & 1) !== 0 || (block.weight ?? 0) >= 600,
      italic: (effects & 2) !== 0,
      underline: (effects & 4) !== 0,
    },
    textAlign: block.align,
  };
}

const LABEL_FIELDS: Field[] = [
  [0, 4, 'fore'], [1, 4, 'back'], [2, 4, 'bits'], [3, 4, 'caption'], [4, 4, 'picpos'], [6, 1, 'mouse'],
  [7, 4, 'border'], [8, 2, 'borderstyle'], [9, 2, 'effect'], [10, 2, 'picture'], [11, 2, 'accel'], [12, 2, 'mouseicon'],
];
const BUTTON_FIELDS: Field[] = [
  [0, 4, 'fore'], [1, 4, 'back'], [2, 4, 'bits'], [3, 4, 'caption'], [4, 4, 'picpos'], [6, 1, 'mouse'], [7, 2, 'picture'], [8, 2, 'accel'], [10, 2, 'mouseicon'],
];
const MORPH_FIELDS: Field[] = [
  [0, 4, 'bits'], [1, 4, 'back'], [2, 4, 'fore'], [3, 4, 'maxlen'], [4, 1, 'borderstyle'], [5, 1, 'scrollbars'], [6, 1, 'display'], [7, 1, 'mouse'],
  [9, 2, 'password'], [10, 4, 'listwidth'], [11, 2, 'bound'], [12, 2, 'textcolumn'], [13, 2, 'columns'], [14, 2, 'listrows'], [15, 2, 'colinfo'],
  [16, 1, 'matchentry'], [17, 1, 'liststyle'], [18, 1, 'showdrop'], [20, 1, 'dropstyle'], [21, 1, 'multiselect'], [22, 4, 'value'], [23, 4, 'caption'],
  [24, 4, 'picpos'], [25, 4, 'border'], [26, 4, 'effect'], [27, 2, 'mouseicon'], [28, 2, 'picture'], [29, 2, 'accel'], [32, 4, 'group'],
];
const FORM_FIELDS: Field[] = [
  [1, 4, 'back'], [2, 4, 'fore'], [3, 4, 'nextid'], [6, 4, 'bools'], [7, 1, 'borderstyle'], [8, 1, 'mouse'], [9, 1, 'scrollbars'], [13, 4, 'groupcount'],
  [15, 2, 'mouseicon'], [16, 1, 'cycle'], [17, 1, 'effect'], [18, 4, 'border'], [19, 4, 'caption'], [20, 2, 'font'], [21, 2, 'picture'], [22, 4, 'zoom'],
  [23, 1, 'picalign'], [25, 1, 'picsize'], [26, 4, 'cookie'], [27, 4, 'drawbuffer'],
];
const SITE_FIELDS: Field[] = [
  [0, 4, 'name'], [1, 4, 'tag'], [2, 4, 'id'], [3, 4, 'help'], [4, 4, 'flags'], [5, 4, 'streamsize'], [6, 2, 'tabindex'], [7, 2, 'clsid'],
  [9, 2, 'group'], [11, 4, 'tip'], [12, 4, 'lickey'], [13, 4, 'controlsource'], [14, 4, 'rowsource'],
];

interface Site {
  name: string;
  tag?: string;
  tip?: string;
  id: number;
  flags: number;
  streamSize: number;
  tabIndex: number;
  clsid: number;
  left: number;
  top: number;
  controlSource?: string;
  rowSource?: string;
}

interface ControlData {
  caption?: string;
  value?: string;
  groupName?: string;
  size: { width: number; height: number } | null;
  bits?: number;
  display?: number;
  fore?: number;
  back?: number;
  password?: number;
  font?: VbaFormFont;
  textAlign?: number;
}

function readControlHeader(reader: Reader, maskBytes: 4 | 8): { start: number; end: number; mask: bigint } {
  const start = reader.pos;
  reader.skip(2);
  const size = reader.u16();
  const mask = maskBytes === 8 ? BigInt(reader.u32()) | (BigInt(reader.u32()) << 32n) : BigInt(reader.u32());
  return { start, end: start + 4 + size, mask };
}

function readCaptioned(reader: Reader, fields: Field[], codePage: number, pictureFirst: boolean): ControlData {
  const { start, end, mask } = readControlHeader(reader, 4);
  const block = readBlock(reader, mask, fields, start);
  const caption = readString(reader, block.caption, start, codePage);
  const size = readSize(reader, hasBit(mask, 5), start);
  reader.pos = end;
  const pictureBit = fields.find((field) => field[2] === 'picture')![0];
  const iconBit = fields.find((field) => field[2] === 'mouseicon')![0];
  const pictures = pictureFirst ? [pictureBit, iconBit] : [iconBit, pictureBit];
  for (const bit of pictures) if (hasBit(mask, bit)) skipPicture(reader);
  const text = readTextProps(reader, codePage);
  return { caption, size, bits: block.bits, fore: block.fore, back: block.back, font: text.font, textAlign: text.textAlign };
}

function readMorph(reader: Reader, codePage: number): ControlData {
  const { start, end, mask } = readControlHeader(reader, 8);
  const block = readBlock(reader, mask, MORPH_FIELDS, start);
  const size = readSize(reader, hasBit(mask, 8), start);
  const value = readString(reader, block.value, start, codePage);
  const caption = readString(reader, block.caption, start, codePage);
  const groupName = readString(reader, block.group, start, codePage);
  reader.pos = end;
  if (hasBit(mask, 27)) skipPicture(reader);
  if (hasBit(mask, 28)) skipPicture(reader);
  const text = readTextProps(reader, codePage);
  return { caption, value, groupName, size, bits: block.bits, display: block.display, fore: block.fore, back: block.back, password: block.password, font: text.font, textAlign: text.textAlign };
}

const SPIN_FIELDS: Field[] = [
  [0, 4, 'fore'], [1, 4, 'back'], [2, 4, 'bits'], [5, 4, 'min'], [6, 4, 'max'], [7, 4, 'position'], [8, 4, 'prev'], [9, 4, 'next'], [10, 4, 'small'],
  [11, 4, 'orientation'], [12, 4, 'delay'], [13, 2, 'mouseicon'], [14, 1, 'mouse'],
];
const SCROLL_FIELDS: Field[] = [
  [0, 4, 'fore'], [1, 4, 'back'], [2, 4, 'bits'], [4, 1, 'mouse'], [5, 4, 'min'], [6, 4, 'max'], [7, 4, 'position'], [9, 4, 'prev'], [10, 4, 'next'],
  [11, 4, 'small'], [12, 4, 'large'], [13, 4, 'orientation'], [14, 2, 'proportional'], [15, 4, 'delay'], [16, 2, 'mouseicon'],
];
const IMAGE_FIELDS: Field[] = [
  [3, 4, 'border'], [4, 4, 'back'], [5, 1, 'borderstyle'], [6, 1, 'mouse'], [7, 1, 'sizemode'], [8, 1, 'effect'], [10, 2, 'picture'], [11, 1, 'align'], [13, 4, 'bits'], [14, 2, 'mouseicon'],
];

function readSized(reader: Reader, fields: Field[], sizeBit: number): ControlData {
  const { start, mask } = readControlHeader(reader, 4);
  const block = readBlock(reader, mask, fields, start);
  const size = readSize(reader, hasBit(mask, sizeBit), start);
  const value = block.position === undefined ? undefined : String(block.position | 0);
  return { size, bits: block.bits, back: block.back, fore: block.fore, value };
}

function readControlData(bytes: Uint8Array, type: VbaFormControlType, codePage: number): ControlData {
  const reader = new Reader(bytes);
  try {
    if (type === 'label') return readCaptioned(reader, LABEL_FIELDS, codePage, true);
    if (type === 'commandbutton') return readCaptioned(reader, BUTTON_FIELDS, codePage, true);
    if (['textbox', 'combobox', 'listbox', 'checkbox', 'optionbutton', 'togglebutton'].includes(type)) return readMorph(reader, codePage);
    if (type === 'spinbutton') return readSized(reader, SPIN_FIELDS, 3);
    if (type === 'scrollbar') return readSized(reader, SCROLL_FIELDS, 3);
    if (type === 'image') return readSized(reader, IMAGE_FIELDS, 9);
    return { size: null };
  } catch {
    return { size: null };
  }
}

interface FormHeader {
  caption?: string;
  size: { width: number; height: number } | null;
  back?: number;
  sites: Site[];
}

function readFormControl(bytes: Uint8Array, codePage: number): FormHeader {
  const reader = new Reader(bytes);
  const { start, end, mask } = readControlHeader(reader, 4);
  const block = readBlock(reader, mask, FORM_FIELDS, start);
  const size = readSize(reader, hasBit(mask, 10), start);
  if (hasBit(mask, 11)) reader.skip(8);
  if (hasBit(mask, 12)) reader.skip(8);
  const caption = readString(reader, block.caption, start, codePage);
  reader.pos = end;
  if (hasBit(mask, 15)) skipPicture(reader);
  if (hasBit(mask, 20)) {
    const guid = reader.bytes.subarray(reader.pos, reader.pos + 16);
    reader.skip(16);
    if (guid[0] === 0x03 && guid[1] === 0x52) {
      reader.skip(10);
      reader.skip(reader.u8());
    } else {
      reader.skip(2);
      reader.skip(reader.u16());
    }
  }
  if (hasBit(mask, 21)) skipPicture(reader);
  if (!((block.bools ?? 0) & FORM_DONT_SAVE_CLASS_TABLE)) {
    const classCount = reader.u16();
    for (let index = 0; index < classCount; index++) {
      reader.skip(2);
      reader.skip(reader.u16());
    }
  }
  const siteCount = reader.u32();
  reader.u32();
  const depthStart = reader.pos;
  let remaining = siteCount;
  while (remaining > 0) {
    reader.u8();
    const mixed = reader.u8();
    if (mixed & 0x80) {
      reader.u8();
      remaining -= mixed & 0x7f;
    } else remaining -= 1;
  }
  reader.align(4, depthStart);
  const sites: Site[] = [];
  for (let index = 0; index < siteCount; index++) sites.push(readSite(reader, codePage));
  return { caption, size, back: block.back, sites };
}

function readSite(reader: Reader, codePage: number): Site {
  const start = reader.pos;
  reader.skip(2);
  const size = reader.u16();
  const end = start + 4 + size;
  const mask = BigInt(reader.u32());
  const block = readBlock(reader, mask, SITE_FIELDS, start);
  const name = readString(reader, block.name, start, codePage) ?? '';
  const tag = readString(reader, block.tag, start, codePage);
  let left = 0;
  let top = 0;
  if (hasBit(mask, 8)) {
    reader.align(4, start);
    left = toPoints(reader.i32());
    top = toPoints(reader.i32());
  }
  const tip = readString(reader, block.tip, start, codePage);
  readString(reader, block.lickey, start, codePage);
  const controlSource = readString(reader, block.controlsource, start, codePage);
  const rowSource = readString(reader, block.rowsource, start, codePage);
  reader.pos = end;
  return {
    name,
    tag: tag || undefined,
    tip: tip || undefined,
    id: block.id ?? 0,
    flags: block.flags ?? SITE_DEFAULT_FLAGS,
    streamSize: block.streamsize ?? 0,
    tabIndex: block.tabindex ?? 0xffff,
    clsid: block.clsid ?? 0x7fff,
    left,
    top,
    controlSource: controlSource || undefined,
    rowSource: rowSource || undefined,
  };
}

const DEFAULT_SIZES: Partial<Record<VbaFormControlType, [number, number]>> = {
  label: [72, 18],
  textbox: [72, 18],
  combobox: [72, 18],
  listbox: [72, 72],
  checkbox: [108, 18],
  optionbutton: [108, 18],
  togglebutton: [72, 24],
  commandbutton: [72, 24],
  spinbutton: [12.75, 25.5],
  scrollbar: [12.75, 63.75],
  image: [72, 72],
  frame: [144, 72],
  multipage: [200, 150],
  tabstrip: [200, 150],
};

function readContainer(read: FormStreamReader, path: string, codePage: number): FormHeader & { controls: VbaFormControlDef[] } {
  const fBytes = read(`${path}/f`);
  if (!fBytes) return { size: null, sites: [], controls: [] };
  const header = readFormControl(fBytes, codePage);
  const oBytes = read(`${path}/o`) ?? new Uint8Array();
  let offset = 0;
  const controls: VbaFormControlDef[] = [];
  header.sites.forEach((site, index) => {
    let type = CLSID_TYPES[site.clsid] ?? 'unknown';
    const slice = oBytes.subarray(offset, offset + site.streamSize);
    offset += site.streamSize;
    const data = site.streamSize ? readControlData(slice, type, codePage) : { size: null };
    if (data.display && DISPLAY_STYLES[data.display] && type !== 'label' && type !== 'commandbutton') type = DISPLAY_STYLES[data.display];
    let children: VbaFormControlDef[] | undefined;
    let size = data.size;
    let caption = data.caption;
    if (type === 'frame' || type === 'multipage') {
      const child = readContainer(read, `${path}/i${String(site.id).padStart(2, '0')}`, codePage);
      children = child.controls;
      size = size ?? child.size;
      caption = caption ?? child.caption;
    }
    const fallback = DEFAULT_SIZES[type] ?? [72, 18];
    const bits = data.bits;
    const isMorph = data.display !== undefined || ['textbox', 'combobox', 'listbox', 'checkbox', 'optionbutton', 'togglebutton'].includes(type);
    controls.push({
      name: site.name,
      type,
      left: site.left,
      top: site.top,
      width: size?.width ?? fallback[0],
      height: size?.height ?? fallback[1],
      caption,
      value: data.value,
      tag: site.tag,
      tip: site.tip,
      rowSource: site.rowSource,
      controlSource: site.controlSource,
      groupName: data.groupName || undefined,
      visible: (site.flags & SITE_VISIBLE) !== 0,
      enabled: bits === undefined ? true : (bits & 0x2) !== 0,
      locked: bits === undefined ? false : (bits & 0x4) !== 0,
      multiLine: isMorph && bits !== undefined ? (bits & 0x80000000) !== 0 : undefined,
      passwordChar: data.password ? String.fromCharCode(data.password) : undefined,
      isDefault: (site.flags & SITE_DEFAULT) !== 0 || undefined,
      isCancel: (site.flags & SITE_CANCEL) !== 0 || undefined,
      tabIndex: site.tabIndex === 0xffff ? index : site.tabIndex,
      foreColor: data.fore,
      backColor: data.back,
      font: data.font,
      textAlign: data.textAlign,
      children,
    });
  });
  return { ...header, controls };
}

export function parseVbFrame(text: string): { caption?: string; width?: number; height?: number; startUpPosition?: number } {
  const value = (key: string) => text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*(?:'.*)?$`, 'im'))?.[1];
  const caption = value('Caption');
  const width = Number(value('ClientWidth'));
  const height = Number(value('ClientHeight'));
  const position = Number(value('StartUpPosition'));
  return {
    caption: caption ? caption.replace(/^"|"$/g, '').replace(/""/g, '"') : undefined,
    width: Number.isFinite(width) && width > 0 ? width / 20 : undefined,
    height: Number.isFinite(height) && height > 0 ? height / 20 : undefined,
    startUpPosition: Number.isFinite(position) ? position : undefined,
  };
}

export function readUserForm(name: string, read: FormStreamReader, codePage: number, decodeFrame: (bytes: Uint8Array) => string): VbaUserFormDef | null {
  const container = readContainer(read, `/${name}`, codePage);
  const frameBytes = read(`/${name}/\u0003VBFrame`);
  const frame = frameBytes ? parseVbFrame(decodeFrame(frameBytes)) : {};
  if (!container.controls.length && !frameBytes) return null;
  return {
    name,
    caption: container.caption ?? frame.caption ?? name,
    width: container.size?.width ?? frame.width ?? 240,
    height: container.size?.height ?? frame.height ?? 180,
    backColor: container.back,
    startUpPosition: frame.startUpPosition,
    controls: container.controls,
  };
}

export function oleColorToCss(color: number | undefined, fallback: string): string {
  if (color === undefined) return fallback;
  if (color & 0x80000000) {
    const system: Record<number, string> = {
      0x05: '#ffffff',
      0x08: '#000000',
      0x0f: '#f0f0f0',
      0x10: '#a0a0a0',
      0x11: '#6d6d6d',
      0x12: '#000000',
      0x0d: '#0078d7',
      0x0e: '#ffffff',
      0x12000: '#000000',
    };
    return system[color & 0xff] ?? fallback;
  }
  const r = color & 0xff;
  const g = (color >> 8) & 0xff;
  const b = (color >> 16) & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
}
