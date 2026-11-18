const templateRecord = 0x0060;
const workbookBof = 0x0809;

function workbookHeader(bytes: Uint8Array) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || data.getUint16(0, true) !== workbookBof || data.getUint16(4, true) !== 0x0600 || data.getUint16(6, true) !== 0x0005) {
    throw new Error('Tệp không chứa sổ làm việc Excel 97–2003 hợp lệ.');
  }
  const firstRecord = 4 + data.getUint16(2, true);
  if (firstRecord + 4 > bytes.length) throw new Error('Tệp bảng tính bị thiếu dữ liệu.');
  return { data, firstRecord };
}

export function hasWorkbookTemplateRecord(bytes: Uint8Array) {
  const { data, firstRecord } = workbookHeader(bytes);
  return data.getUint16(firstRecord, true) === templateRecord && data.getUint16(firstRecord + 2, true) === 0;
}

function binaryTemplateWorkbook(bytes: Uint8Array) {
  if (hasWorkbookTemplateRecord(bytes)) return bytes;
  const { firstRecord } = workbookHeader(bytes);
  const result = new Uint8Array(bytes.length + 4);
  result.set(bytes.subarray(0, firstRecord));
  result[firstRecord] = templateRecord;
  result.set(bytes.subarray(firstRecord), firstRecord + 4);
  const data = new DataView(result.buffer);
  const relocate = (position: number) => {
    const value = data.getUint32(position, true);
    if (value >= firstRecord && value < bytes.length) data.setUint32(position, value + 4, true);
  };
  for (let start = firstRecord + 4; start + 4 <= result.length;) {
    const code = data.getUint16(start, true);
    const size = data.getUint16(start + 2, true);
    const body = start + 4;
    if (body + size > result.length) throw new Error('Tệp bảng tính bị thiếu dữ liệu.');
    if (code === 0x0085 && size >= 4) relocate(body);
    if (code === 0x00ff) for (let i = 2; i + 8 <= size; i += 8) relocate(body + i);
    if (code === 0x020b) for (let i = 12; i + 4 <= size; i += 4) relocate(body + i);
    start = body + size;
  }
  return result;
}

export async function createLegacyTemplate(bytes: Uint8Array<ArrayBuffer>, format: 'dot' | 'xlt') {
  const { read, find, write } = await import('cfb');
  const file = read(bytes, { type: 'array' });
  const stream = find(file, format === 'dot' ? '/WordDocument' : '/Workbook');
  if (!stream || stream.type !== 2) throw new Error('Tệp Office thiếu thành phần chính.');
  const binary = Uint8Array.from(stream.content);
  if (format === 'dot') {
    if (binary.length < 32 || binary[0] !== 0xec || binary[1] !== 0xa5) throw new Error('Tệp không chứa tài liệu Word 97–2003 hợp lệ.');
    binary[10] |= 1;
    stream.content = binary;
  } else {
    stream.content = binaryTemplateWorkbook(binary);
  }
  stream.size = stream.content.length;
  return Uint8Array.from(write(file, { type: 'array', fileType: 'cfb' }));
}
