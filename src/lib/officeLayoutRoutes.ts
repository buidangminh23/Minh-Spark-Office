import { officeFileKind } from './officeConversionFormats';
import { packageBase } from './conversionPackages';

const nativeFamilies: Record<string, readonly string[]> = {
  docx: ['doc', 'dot', 'docx', 'docm', 'dotm', 'odt', 'rtf'],
  xlsx: ['xls', 'xlt', 'xlsx', 'xlsm', 'xltm', 'xlsb', 'ods'],
  pptx: ['ppt', 'pps', 'pot', 'pptx', 'pptm', 'potm', 'ppsm', 'odp'],
};
const filtered: Record<string, string> = { doc: 'docx', rtf: 'docx', odt: 'docx', xls: 'xlsx', ods: 'xlsx', ppt: 'pptx', odp: 'pptx' };
const needsImport = ['doc', 'dot', 'docm', 'dotm', 'odt', 'rtf', 'xlt', 'xltm', 'ppt', 'pps', 'pot', 'pptm', 'ppsm', 'potm', 'odp'];
const pageOutputs = ['pdf', 'png', 'jpg', 'webp', 'tiff', 'bmp'];
const nativeFamily = (ext: string) => Object.keys(nativeFamilies).find(key => nativeFamilies[key].includes(ext));

export type ConversionStep = { via: 'copy' | 'package' | 'native' | 'office' | 'media'; target: string; editable?: boolean };

export function supportsOfficeLayout(name: string, target: string) {
  const ext = name.split('.').pop()!.toLowerCase();
  const source = nativeFamily(packageBase[ext] ?? ext);
  if (!source) return false;
  const core = packageBase[target] ?? target;
  const family = filtered[core] ?? core;
  return pageOutputs.includes(core) || core === 'html' || (['docx', 'xlsx', 'pptx'].includes(family) && source !== family);
}

export function conversionPlan(name: string, target: string, fidelity: 'layout' | 'editable' = 'layout'): ConversionStep[] {
  const ext = name.split('.').pop()!.toLowerCase();
  const source = packageBase[ext] ?? ext;
  const dest = packageBase[target] ?? target;
  const native = nativeFamily(source);
  if (ext === target && (native || ext === 'epub')) return [{ via: 'copy', target }];
  if (['html', 'md', 'txt'].includes(target) && (target === ext || (ext === 'htm' && target === 'html'))) return [{ via: 'copy', target }];
  if (target === 'xlsb') {
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
        if (core === 'bmp' || core === 'tiff') steps.push({ via: 'office', target: 'pdf' }, { via: 'media', target: core });
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
