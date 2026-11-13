import type { VbaModuleData, VbaProjectData } from '../../../lib/vbaProject';
import { procShortcut } from '../../../lib/vbaProject';
import { ExcelModel, RangeObject, evaluateBracketText, type Box4, type ExcelHostCallbacks } from './vbaExcel';
import { Box, VbaInterpreter, runnableMacros, type VbaHost, type VbaModuleSource } from './vbaInterpreter';
import { VbaArray, VbaCollection, VbaDictionary, VbaError, VbaObject, type VbaValue } from './vbaRuntime';
import { UserFormSession } from './vbaUserForm';

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
export const FORM_DOCUMENT_PREFIX = '\u0000form:';

const documentTarget = (project: VbaProjectData, moduleName: string): string | undefined => {
  const lower = moduleName.toLowerCase();
  if ((project.workbookCodeName ?? 'ThisWorkbook').toLowerCase() === lower) return WORKBOOK_DOCUMENT;
  const entry = Object.entries(project.sheetCodeNames ?? {}).find(([, codeName]) => codeName.toLowerCase() === lower);
  return entry?.[0];
};

export const vbaSources = (project: VbaProjectData | null | undefined): VbaModuleSource[] =>
  (project?.modules ?? []).map((module) => ({
    name: module.name,
    code: module.code,
    document: module.kind === 'document' ? documentTarget(project!, module.name) : module.kind === 'form' ? `${FORM_DOCUMENT_PREFIX}${module.name}` : undefined,
  }));

const macroSources = (project: VbaProjectData | null | undefined): VbaModuleSource[] => vbaSources(project).filter((source) => !source.document?.startsWith(FORM_DOCUMENT_PREFIX));

export function listVbaMacros(project: VbaProjectData | null | undefined): VbaMacroInfo[] {
  if (!project?.modules.length) return [];
  const modules = new Map<string, VbaModuleData>(project.modules.map((module) => [module.name.toLowerCase(), module]));
  return runnableMacros(macroSources(project)).map((proc) => ({
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

export interface VbaHostExtras {
  forms?: () => UserFormSession | null;
  beginSlice?(): void;
  endSlice?(): void;
  endAll?(): void;
}

export function createExcelHost(api: unknown, callbacks: VbaRunCallbacks, model = new ExcelModel(api as ConstructorParameters<typeof ExcelModel>[0], callbacks), extras: VbaHostExtras = {}): VbaHost {
  return {
    application: model.application,
    msgBox: (prompt, buttons, title) => callbacks.msgBox(prompt, buttons, title),
    inputBox: (prompt, title, defaultValue) => callbacks.inputBox(prompt, title, defaultValue),
    print: (text) => callbacks.print(text),
    evaluateBracket: (text) => evaluateBracketText(model, text),
    beginSlice: extras.beginSlice,
    endSlice: () => {
      model.flushRowVisibility();
      extras.endSlice?.();
    },
    endAll: extras.endAll,
    documentObject: (target) => {
      try {
        if (target === WORKBOOK_DOCUMENT) {
          const workbook = model.application.get('thisworkbook', { values: [], names: [] });
          return workbook instanceof VbaObject ? workbook : null;
        }
        if (target.startsWith(FORM_DOCUMENT_PREFIX)) return extras.forms?.()?.instance(target.slice(FORM_DOCUMENT_PREFIX.length)) ?? null;
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

export interface VbaSessionCallbacks extends VbaRunCallbacks {
  report(error: string): void;
  beginSlice?(): void;
  endSlice?(): void;
  formsChanged?(): void;
}

export const WORKBOOK_EVENTS = ['Workbook_Open', 'Workbook_BeforeSave', 'Workbook_SheetChange', 'Workbook_SheetSelectionChange', 'Workbook_SheetActivate', 'Workbook_SheetDeactivate', 'Workbook_BeforeClose'];
export const SHEET_EVENTS = ['Worksheet_Change', 'Worksheet_SelectionChange', 'Worksheet_Activate', 'Worksheet_Deactivate', 'Worksheet_BeforeDoubleClick'];

export function projectHasEvents(project: VbaProjectData | null | undefined): boolean {
  if (!project) return false;
  const pattern = new RegExp(`\\b(${[...WORKBOOK_EVENTS, ...SHEET_EVENTS].join('|')})\\b`, 'i');
  return project.modules.some((module) => module.kind === 'document' && pattern.test(module.code)) || !!project.forms?.length;
}

export class VbaSession {
  readonly interpreter: VbaInterpreter;
  readonly model: ExcelModel;
  readonly forms: UserFormSession;
  readonly project: VbaProjectData;
  readonly api: unknown;
  private readonly callbacks: VbaSessionCallbacks;

  constructor(project: VbaProjectData, api: unknown, callbacks: VbaSessionCallbacks) {
    this.project = project;
    this.api = api;
    this.callbacks = callbacks;
    this.model = new ExcelModel(api as ConstructorParameters<typeof ExcelModel>[0], callbacks);
    this.forms = new UserFormSession(project.forms ?? [], {
      hasHandler: (module, proc) => this.interpreter.hasProcedure(module, proc),
      fire: (module, proc, args) => this.interpreter.runEvent(`${module}.${proc}`, args),
      wait: (promise) => this.interpreter.requestWait(promise),
      resetModule: (module) => this.interpreter.resetModule(module),
      readRange: (address) => this.readRange(address),
      report: (error) => callbacks.report(describeVbaError(error)),
    });
    this.forms.subscribe(() => callbacks.formsChanged?.());
    const host = createExcelHost(api, callbacks, this.model, {
      forms: () => this.forms,
      beginSlice: callbacks.beginSlice,
      endSlice: callbacks.endSlice,
      endAll: () => this.forms.closeAll(),
    });
    this.interpreter = new VbaInterpreter(vbaSources(project), host);
  }

  get eventsEnabled(): boolean {
    return this.model.application.eventsEnabled;
  }

  get busy(): boolean {
    return this.interpreter.isRunning;
  }

  async run(macroId: string): Promise<VbaRunResult> {
    try {
      await this.interpreter.runAsync(macroId);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describeVbaError(error) };
    }
  }

  private documentModule(target: string): string | null {
    if (target === WORKBOOK_DOCUMENT) return this.project.workbookCodeName ?? 'ThisWorkbook';
    return this.project.sheetCodeNames?.[target] ?? null;
  }

  private sheetModuleById(sheetId: string): string | null {
    const sheet = this.model.sheetById(sheetId);
    if (!sheet) return null;
    const name = String(sheet.sheet.getSheetName());
    return this.documentModule(name);
  }

  async fire(module: string | null, proc: string, args: Array<VbaValue | Box>): Promise<boolean> {
    if (!module || !this.interpreter.hasProcedure(module, proc)) return false;
    if (!this.eventsEnabled) return false;
    try {
      await this.interpreter.runEvent(`${module}.${proc}`, args);
    } catch (error) {
      this.callbacks.report(describeVbaError(error));
    }
    return true;
  }

  workbookOpen() {
    return this.fire(this.documentModule(WORKBOOK_DOCUMENT), 'Workbook_Open', []);
  }

  async beforeSave(): Promise<boolean> {
    const cancel = new Box(false, 'boolean');
    await this.fire(this.documentModule(WORKBOOK_DOCUMENT), 'Workbook_BeforeSave', [false, cancel]);
    return cancel.v === true;
  }

  async sheetChange(sheetId: string, box: Box4) {
    const target = this.model.rangeOn(sheetId, box);
    if (!target) return;
    await this.fire(this.sheetModuleById(sheetId), 'Worksheet_Change', [target]);
    await this.fire(this.documentModule(WORKBOOK_DOCUMENT), 'Workbook_SheetChange', [this.model.sheetById(sheetId), target]);
  }

  async selectionChange(sheetId: string, box: Box4) {
    const target = this.model.rangeOn(sheetId, box);
    if (!target) return;
    await this.fire(this.sheetModuleById(sheetId), 'Worksheet_SelectionChange', [target]);
    await this.fire(this.documentModule(WORKBOOK_DOCUMENT), 'Workbook_SheetSelectionChange', [this.model.sheetById(sheetId), target]);
  }

  async sheetActivate(previousId: string | null, sheetId: string) {
    if (previousId) {
      await this.fire(this.sheetModuleById(previousId), 'Worksheet_Deactivate', []);
      await this.fire(this.documentModule(WORKBOOK_DOCUMENT), 'Workbook_SheetDeactivate', [this.model.sheetById(previousId)]);
    }
    await this.fire(this.sheetModuleById(sheetId), 'Worksheet_Activate', []);
    await this.fire(this.documentModule(WORKBOOK_DOCUMENT), 'Workbook_SheetActivate', [this.model.sheetById(sheetId)]);
  }

  async beforeDoubleClick(sheetId: string, box: Box4): Promise<boolean> {
    const target = this.model.rangeOn(sheetId, box);
    if (!target) return false;
    const cancel = new Box(false, 'boolean');
    await this.fire(this.sheetModuleById(sheetId), 'Worksheet_BeforeDoubleClick', [target, cancel]);
    return cancel.v === true;
  }

  hasEvent(target: 'workbook' | string, proc: string): boolean {
    const module = target === 'workbook' ? this.documentModule(WORKBOOK_DOCUMENT) : this.sheetModuleById(target);
    return !!module && this.interpreter.hasProcedure(module, proc);
  }

  private readRange(address: string): VbaValue[][] {
    const range = this.model.rangeFromAddress(address.replace(/^=/, ''), this.model.activeSheet());
    const value = range.get('value', { values: [], names: [] });
    if (value instanceof VbaArray) return value.bounds.length === 1 ? [value.data] : value.rows();
    return [[value]];
  }

  dispose() {
    this.forms.closeAll();
  }
}

const TRUSTED_KEY = 'minh-sheets-vba-trusted';
const MAX_TRUSTED = 500;

const readTrusted = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TRUSTED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export function isVbaTrusted(fileId: string): boolean {
  return readTrusted().includes(fileId);
}

export function trustVba(fileId: string) {
  try {
    const next = [fileId, ...readTrusted().filter((item) => item !== fileId)].slice(0, MAX_TRUSTED);
    localStorage.setItem(TRUSTED_KEY, JSON.stringify(next));
  } catch {
    void 0;
  }
}

export const isRangeObject = (value: unknown): value is RangeObject => value instanceof RangeObject;
