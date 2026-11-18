import { officeFileKind } from './officeConversionFormats';
import { macroOutputBase, packageBase } from './conversionPackages';
import { conversionAliases, withConversionExtension } from './conversionAliases';
import { IMAGE_OUTPUT_EXTENSIONS } from './mediaConversionFormats';
import { isDataExchangeFormat } from './dataExchangeFormats';

const nativeFamilies: Record<string, readonly string[]> = {
  docx: ['doc', 'dot', 'docx', 'docm', 'odt', 'fodt', 'rtf'],
  xlsx: ['xls', 'xlt', 'xlsx', 'xlsm', 'xlsb', 'ods', 'fods'],
  pptx: ['ppt', 'pps', 'pot', 'pptx', 'pptm', 'odp', 'fodp'],
};
const filtered: Record<string, string> = { dot: 'docx', doc: 'docx', rtf: 'docx', odt: 'docx', fodt: 'docx', xlt: 'xlsx', xls: 'xlsx', ods: 'xlsx', fods: 'xlsx', pot: 'pptx', pps: 'pptx', ppt: 'pptx', odp: 'pptx', fodp: 'pptx' };
const needsImport = ['doc', 'dot', 'docm', 'odt', 'fodt', 'rtf', 'xlt', 'fods', 'ppt', 'pps', 'pot', 'pptm', 'odp', 'fodp'];
const pageOutputs = ['pdf', ...IMAGE_OUTPUT_EXTENSIONS];
const nativeFamily = (ext: string) => Object.keys(nativeFamilies).find(key => nativeFamilies[key].includes(ext));

export type ConversionStep = { via: 'copy' | 'package' | 'native' | 'office' | 'media' | 'xhtml'; target: string; editable?: boolean };

export function supportsOfficeLayout(name: string, target: string) {
  const ext = name.split('.').pop()!.toLowerCase();
  const canonical = conversionAliases[ext] ?? ext;
  const source = isDataExchangeFormat(canonical) ? 'xlsx' : nativeFamily(packageBase[canonical] ?? canonical);
  if (!source) return false;
  const core = macroOutputBase[target] ?? packageBase[target] ?? conversionAliases[target] ?? target;
  const family = filtered[core] ?? core;
  return pageOutputs.includes(core) || ['html', 'xhtml'].includes(core) || (['docx', 'xlsx', 'pptx'].includes(family) && source !== family);
}

export function conversionPlan(name: string, target: string, fidelity: 'layout' | 'editable' = 'layout'): ConversionStep[] {
  const ext = name.split('.').pop()!.toLowerCase();
  if (typeof conversionAliases[ext] === 'string') return conversionPlan(withConversionExtension(name, conversionAliases[ext]), target, fidelity);
  if (typeof conversionAliases[target] === 'string') return conversionPlan(name, conversionAliases[target], fidelity);
  const source = packageBase[ext] ?? ext;
  const dest = packageBase[target] ?? target;
  const native = nativeFamily(source);
  if (source === 'xhtml') {
    if (target === 'html' || target === 'xhtml') return [{ via: 'xhtml', target }];
    return [{ via: 'xhtml', target: 'html' }, ...conversionPlan('source.html', target, fidelity)];
  }
  if (target === 'xhtml') return [...conversionPlan(name, 'html', fidelity).filter(step => step.via !== 'copy'), { via: 'xhtml', target }];
  if (ext === target && (native || ext === 'epub')) return [{ via: 'copy', target }];
  if (isDataExchangeFormat(source)) {
    if (isDataExchangeFormat(target) || ['csv', 'tsv', 'json', 'xlsx'].includes(target)) return [{ via: 'office', target }];
    return [{ via: 'office', target: 'xlsx' }, ...conversionPlan('book.xlsx', target, fidelity)];
  }
  if (macroOutputBase[target] && source !== dest) {
    return [...conversionPlan(name, macroOutputBase[target]!, fidelity).filter(step => step.via !== 'copy'), { via: 'package', target }];
  }
  if (['html', 'md', 'txt'].includes(target) && (target === ext || (ext === 'htm' && target === 'html'))) return [{ via: 'copy', target }];
  if (target === 'xlsb' || isDataExchangeFormat(target)) {
    if (isDataExchangeFormat(target) && ['xlsx', 'xlsm', 'xlsb', 'ods', 'xls', 'csv', 'tsv', 'json'].includes(ext)) return [{ via: 'office', target }];
    const importSteps = conversionPlan(name, 'xlsx', 'editable').filter(step => step.via !== 'copy');
    return [...importSteps.map(step => step.via === 'media' ? { ...step, editable: true } : step), { via: 'office', target }];
  }
  if (source === dest && (ext !== source || target !== dest)) return [{ via: 'package', target }];
  const steps: ConversionStep[] = [];
  if (source !== ext) steps.push({ via: 'package', target: source });
  const endFamily = filtered[dest] ?? dest;
  if (native && native === endFamily) {
    if (source !== dest) steps.push({ via: 'native', target: dest });
  } else {
    const core = filtered[dest] ?? dest;
    if (fidelity === 'layout' && supportsOfficeLayout(name, core)) {
      steps.push({ via: 'native', target: 'pdf' });
      if (core !== 'pdf') steps.push({ via: 'media', target: core });
    } else {
      if (needsImport.includes(source) && native) steps.push({ via: 'native', target: native });
      if (officeFileKind(name)) {
        if (IMAGE_OUTPUT_EXTENSIONS.includes(core) && !['png', 'jpg', 'webp'].includes(core)) steps.push({ via: 'office', target: 'pdf' }, { via: 'media', target: core });
        else steps.push({ via: 'office', target: core });
      } else if (['md', 'epub'].includes(core)) {
        steps.push({ via: 'media', target: 'docx', editable: true }, { via: 'office', target: core });
      } else {
        steps.push({ via: 'media', target: core });
      }
    }
    if (core !== dest) steps.push({ via: 'native', target: dest });
  }
  if (target !== dest) steps.push({ via: 'package', target });
  return steps;
}
