import { conversionTargets } from './conversionRegistry';
import { conversionAliases, withConversionExtension } from './conversionAliases';
import { conversionPlan } from './officeLayoutRoutes';
import { changeOfficePackage } from './conversionPackages';
import { checkLegacySheetSize, checkNativeFile } from './officeNativeFormats';
import { checkConversionAbort, conversionBaseName, type ConversionFile, type ConversionOptions, type ConversionResult } from './conversionTypes';

export { CONVERSION_ACCEPT, conversionTargets } from './conversionRegistry';
export const MAX_CONVERSION_BYTES = 100 * 1024 * 1024;
export const MAX_CONVERSION_BATCH_BYTES = 200 * 1024 * 1024;
export const MAX_CONVERSION_FILES = 20;

export async function convertFile(file: File, target: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  checkConversionAbort(options);
  if (!file.size) throw new Error('Tệp trống, không có dữ liệu để chuyển đổi.');
  if (file.size > MAX_CONVERSION_BYTES) throw new Error('Tệp vượt quá 100 MB. Hãy chia nhỏ tệp trước khi chuyển đổi.');
  if (!conversionTargets(file.name).some((format) => format.id === target)) throw new Error('Định dạng chuyển đổi này chưa được hỗ trợ cho tệp đã chọn.');
  const sourceAlias = conversionAliases[file.name.split('.').pop()!.toLowerCase()];
  const targetAlias = conversionAliases[target];
  if (sourceAlias || targetAlias) {
    const input = sourceAlias ? new File([file], withConversionExtension(file.name, sourceAlias), { type: file.type, lastModified: file.lastModified }) : file;
    const result = await convertFile(input, targetAlias ?? target, options);
    return targetAlias ? { ...result, files: result.files.map(part => ({ ...part, name: withConversionExtension(part.name, target) })) } : result;
  }
  const steps = conversionPlan(file.name, target, options.fidelity);
  const usesNative = steps.some(step => step.via === 'native');
  let result: ConversionResult = { files: [], warnings: [] };
  let session = options.layoutSession;
  const warnings = new Set<string>();
  const macroInput = /\.(docm|dotm|xlsm|xltm|pptm|ppsm|potm|xlsb)$/i.test(file.name);
  if (macroInput && steps.some(step => step.via !== 'copy' && step.via !== 'package')) warnings.add('Định dạng đích không giữ macro VBA. Hãy giữ tệp gốc để tiếp tục sử dụng macro.');
  const base = conversionBaseName(file.name);
  let input = file;
  try {
    if (file.size > 50 * 1024 * 1024 && steps[0]?.via !== 'media') throw new Error('Tệp Office vượt giới hạn 50 MB. Hãy chia nhỏ tệp trước khi chuyển đổi.');
    if (usesNative && !session) {
      const { openOfficeLayoutSession } = await import('./officeLayoutSession');
      if (steps[0].via === 'native' && isOfficeArchive(file.name)) await (await import('./openOfficeZip')).openOfficeZip(await file.arrayBuffer());
      session = openOfficeLayoutSession();
    }
    for (const [index, step] of steps.entries()) {
      checkConversionAbort(options);
      const ext = input.name.split('.').pop()!.toLowerCase();
      const name = `${base}.${step.target}`;
      if (step.via === 'office') {
        result = await (await import('./officeConversion')).convertOfficeFile(input, step.target, options);
      } else if (step.via === 'media') {
        result = await (await import('./mediaConversion')).convertMediaFile(input, step.target, step.editable ? { ...options, fidelity: 'editable' } : options);
      } else {
        let blob: Blob;
        if (step.via === 'xhtml') {
          blob = await (await import('./xhtmlConversion')).convertXhtml(input, step.target);
        } else if (step.via === 'copy') {
          await checkNativeFile(await input.arrayBuffer(), ext);
          blob = input;
        } else if (step.via === 'package') {
          blob = await changeOfficePackage(input, ext, step.target);
        } else {
          if (isOfficeArchive(input.name) && (index > 0 || options.layoutSession)) await (await import('./openOfficeZip')).openOfficeZip(await input.arrayBuffer());
          if (['xls', 'xlt'].includes(step.target)) await checkLegacySheetSize(input);
          blob = await session!.render(input, options, step.target);
          if (['doc', 'dot', 'ppt', 'pot', 'pps', 'xls', 'xlt'].includes(step.target)) warnings.add('Định dạng Office 97–2003 có giới hạn với các tính năng và đối tượng mới.');
        }
        result = { files: [{ name, blob }], warnings: [] };
      }
      for (const warning of result.warnings) warnings.add(warning);
      if (index < steps.length - 1) {
        if (result.files.length !== 1 || !result.files[0].blob.size) throw new Error('Bước chuyển trung gian chưa tạo được tệp.');
        input = new File([result.files[0].blob], name, { type: result.files[0].blob.type });
      }
    }
    result.warnings = [...warnings];
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'PasswordException') throw new Error('PDF được bảo vệ bằng mật khẩu. Hãy mở khóa bản sao rồi chuyển đổi.');
      if (error.name === 'InvalidPDFException') throw new Error('Nội dung tệp không phải PDF hợp lệ hoặc đã bị hỏng.');
      if (/central directory|Corrupted zip|Invalid signature|Unsupported compression/i.test(error.message)) throw new Error('Tệp Office bị hỏng hoặc nội dung không khớp phần mở rộng. Hãy mở và lưu lại từ ứng dụng gốc.');
    }
    throw error;
  } finally {
    if (session && !options.layoutSession) session.close();
  }
  checkConversionAbort(options);
  if (!result.files.length || result.files.some((output) => !output.blob.size)) throw new Error('Không tạo được tệp có nội dung.');
  return result;
}

function isOfficeArchive(name: string) {
  return /\.(?:doc[xm]|dot[xm]|xls[xmb]|xlt[xm]|ppt[xm]|pps[xm]|pot[xm]|o[dt][tsp])$/i.test(name);
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
