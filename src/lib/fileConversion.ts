import { officeConversionTargets } from './officeConversionFormats';
import { mediaConversionTargets } from './mediaConversionFormats';
import { checkConversionAbort, type ConversionFile, type ConversionOptions, type ConversionResult } from './conversionTypes';

export const CONVERSION_ACCEPT = '.docx,.dotx,.txt,.md,.html,.htm,.xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.pptx,.ppsx,.potx,.pdf,.png,.jpg,.jpeg,.jfif,.jpe,.webp,.gif,.svg,.bmp,.ico,.avif,.tif,.tiff,.heic,.heif';
export const MAX_CONVERSION_BYTES = 100 * 1024 * 1024;
export const MAX_CONVERSION_BATCH_BYTES = 200 * 1024 * 1024;
export const MAX_CONVERSION_FILES = 20;

export function conversionTargets(fileName: string) {
  const media = mediaConversionTargets(fileName);
  return media.length ? media : officeConversionTargets(fileName);
}

export async function convertFile(file: File, target: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  checkConversionAbort(options);
  if (!file.size) throw new Error('Tệp trống, không có dữ liệu để chuyển đổi.');
  if (file.size > MAX_CONVERSION_BYTES) throw new Error('Tệp vượt quá 100 MB. Hãy chia nhỏ tệp trước khi chuyển đổi.');
  if (!conversionTargets(file.name).some((format) => format.id === target)) throw new Error('Định dạng chuyển đổi này chưa được hỗ trợ cho tệp đã chọn.');
  let result: ConversionResult;
  try {
    result = mediaConversionTargets(file.name).length
      ? await (await import('./mediaConversion')).convertMediaFile(file, target, options)
      : await (await import('./officeConversion')).convertOfficeFile(file, target, options);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'PasswordException') throw new Error('PDF được bảo vệ bằng mật khẩu. Hãy mở khóa bản sao rồi chuyển đổi.');
      if (error.name === 'InvalidPDFException') throw new Error('Nội dung tệp không phải PDF hợp lệ hoặc đã bị hỏng.');
      if (/central directory|Corrupted zip|Invalid signature|Unsupported compression/i.test(error.message)) throw new Error('Tệp Office bị hỏng hoặc nội dung không khớp phần mở rộng. Hãy mở và lưu lại từ ứng dụng gốc.');
    }
    throw error;
  }
  checkConversionAbort(options);
  if (!result.files.length || result.files.some((output) => !output.blob.size)) throw new Error('Không tạo được tệp có nội dung.');
  return result;
}

export function uniqueConversionNames(files: ConversionFile[]): ConversionFile[] {
  const used = new Set<string>();
  return files.map((file) => {
    const safe = file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '') || 'Tai-lieu';
    const dot = safe.lastIndexOf('.');
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const extension = dot > 0 ? safe.slice(dot) : '';
    let name = safe;
    let index = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${index++})${extension}`;
    used.add(name.toLowerCase());
    return { ...file, name };
  });
}

export async function conversionZip(files: ConversionFile[]) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const file of uniqueConversionNames(files)) zip.file(file.name, await file.blob.arrayBuffer());
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
}
