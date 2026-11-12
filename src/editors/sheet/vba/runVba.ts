import type { VbaModuleData, VbaProjectData } from '../../../lib/vbaProject';
import { procShortcut } from '../../../lib/vbaProject';
import { ExcelModel, evaluateBracketText, type ExcelHostCallbacks } from './vbaExcel';
import { VbaInterpreter, runnableMacros, type VbaHost, type VbaModuleSource } from './vbaInterpreter';
import { VbaCollection, VbaDictionary, VbaError, VbaObject } from './vbaRuntime';

export const VB_OK = 1;
export const VB_CANCEL = 2;
export const VB_YES = 6;
export const VB_NO = 7;

export interface VbaRunCallbacks extends ExcelHostCallbacks {
  print(text: string): void;
}

export interface VbaMacroInfo {
  id: string;
  module: string;
  name: string;
  shortcut: string;
}

export interface VbaRunResult {
  ok: boolean;
  error?: string;
}

export const WORKBOOK_DOCUMENT = '\u0000workbook';

const documentTarget = (project: VbaProjectData, moduleName: string): string | undefined => {
  const lower = moduleName.toLowerCase();
  if ((project.workbookCodeName ?? 'ThisWorkbook').toLowerCase() === lower) return WORKBOOK_DOCUMENT;
  const entry = Object.entries(project.sheetCodeNames ?? {}).find(([, codeName]) => codeName.toLowerCase() === lower);
  return entry?.[0];
};

export const vbaSources = (project: VbaProjectData | null | undefined): VbaModuleSource[] =>
  (project?.modules ?? [])
    .filter((module) => module.kind !== 'form')
    .map((module) => ({ name: module.name, code: module.code, document: module.kind === 'document' ? documentTarget(project!, module.name) : undefined }));

export function listVbaMacros(project: VbaProjectData | null | undefined): VbaMacroInfo[] {
  if (!project?.modules.length) return [];
  const modules = new Map<string, VbaModuleData>(project.modules.map((module) => [module.name.toLowerCase(), module]));
  return runnableMacros(vbaSources(project)).map((proc) => ({
    id: `${proc.module}.${proc.name}`,
    module: proc.module,
    name: proc.name,
    shortcut: procShortcut(modules.get(proc.module.toLowerCase())?.procAttributes?.[proc.name.toLowerCase()]),
  }));
}

export function messageBoxAnswer(buttons: number, confirm: (text: string) => boolean, alert: (text: string) => void, prompt: string): number {
  const kind = buttons & 0x7;
  if (kind === 0) {
    alert(prompt);
    return VB_OK;
  }
  const accepted = confirm(prompt);
  if (kind === 1) return accepted ? VB_OK : VB_CANCEL;
  if (kind === 4 || kind === 3) return accepted ? VB_YES : VB_NO;
  return accepted ? VB_OK : VB_CANCEL;
}

export function createExcelHost(api: unknown, callbacks: VbaRunCallbacks): VbaHost {
  const model = new ExcelModel(api as ConstructorParameters<typeof ExcelModel>[0], callbacks);
  return {
    application: model.application,
    msgBox: (prompt, buttons, title) => callbacks.msgBox(prompt, buttons, title),
    inputBox: (prompt, title, defaultValue) => callbacks.inputBox(prompt, title, defaultValue),
    print: (text) => callbacks.print(text),
    evaluateBracket: (text) => evaluateBracketText(model, text),
    documentObject: (target) => {
      try {
        if (target === WORKBOOK_DOCUMENT) {
          const workbook = model.application.get('thisworkbook', { values: [], names: [] });
          return workbook instanceof VbaObject ? workbook : null;
        }
        return model.sheetByKey(target);
      } catch {
        return null;
      }
    },
    createObject: (progId) => {
      const name = progId.toLowerCase();
      if (name === 'scripting.dictionary') return new VbaDictionary();
      if (name === 'vba.collection') return new VbaCollection();
      return null;
    },
  };
}

export function describeVbaError(error: unknown): string {
  if (error instanceof VbaError) {
    const where = [error.source, error.line ? `dòng ${error.line}` : ''].filter(Boolean).join(', ');
    return `Lỗi ${error.number}: ${error.message}${where ? ` (${where})` : ''}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function runVbaMacro(project: VbaProjectData, macroId: string, host: VbaHost): VbaRunResult {
  try {
    const interpreter = new VbaInterpreter(vbaSources(project), host);
    interpreter.run(macroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeVbaError(error) };
  }
}
