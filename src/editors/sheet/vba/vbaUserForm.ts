import type { VbaFormControlDef, VbaFormControlType, VbaUserFormDef } from '../../../lib/vbaForms';
import { Box, type VbaWait } from './vbaInterpreter';
import { VbaArray, VbaError, VbaObject, arg, isMissing, noArgs, scalar, toBool, toInteger, toNumber, toStr, type VbaArgs, type VbaValue } from './vbaRuntime';

export interface UserFormCallbacks {
  hasHandler(module: string, proc: string): boolean;
  fire(module: string, proc: string, args: Array<VbaValue | Box>): Promise<unknown>;
  wait(promise: VbaWait): void;
  resetModule(module: string): void;
  readRange?(address: string): VbaValue[][];
  report?(error: unknown): void;
}

const VB_MODELESS = 0;
const CLOSE_MODE_MENU = 0;
const CLOSE_MODE_CODE = 1;
const MS_FORMS_LIST_TYPES = new Set<VbaFormControlType>(['listbox', 'combobox']);
const TOGGLE_TYPES = new Set<VbaFormControlType>(['checkbox', 'optionbutton', 'togglebutton']);

const FORM_MEMBERS = new Set([
  'show', 'hide', 'caption', 'width', 'height', 'left', 'top', 'controls', 'name', 'repaint', 'insidewidth', 'insideheight', 'tag', 'backcolor',
  'startupposition', 'activecontrol', 'visible', 'scrollheight', 'scrollwidth', 'printform', 'setfocus',
]);

export class ReturnBoolean extends VbaObject {
  readonly typeName = 'ReturnBoolean';
  value = false;
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'value') return this.value;
    return super.get(name, args);
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    if (name !== 'value') return false;
    this.value = toBool(value ?? false);
    return true;
  }
  defaultGet(args: VbaArgs): VbaValue {
    return args.values.length ? super.defaultGet(args) : this.value;
  }
  defaultSet(_args: VbaArgs, value: VbaValue): void {
    this.value = toBool(value ?? false);
  }
}

class FontObject extends VbaObject {
  readonly typeName = 'Font';
  private readonly control: FormControl;
  constructor(control: FormControl) {
    super();
    this.control = control;
  }
  get(name: string, args: VbaArgs): VbaValue {
    const font = this.control.font;
    switch (name) {
      case 'name':
        return font.name ?? 'Tahoma';
      case 'size':
        return font.size ?? 8.25;
      case 'bold':
        return !!font.bold;
      case 'italic':
        return !!font.italic;
      case 'underline':
        return !!font.underline;
    }
    return super.get(name, args);
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    const font = this.control.font;
    if (name === 'name') font.name = toStr(value);
    else if (name === 'size') font.size = toNumber(value);
    else if (name === 'bold') font.bold = toBool(value ?? false);
    else if (name === 'italic') font.italic = toBool(value ?? false);
    else if (name === 'underline') font.underline = toBool(value ?? false);
    else return false;
    this.control.form.session.touch();
    return true;
  }
}

class ControlsCollection extends VbaObject {
  readonly typeName = 'Controls';
  private readonly list: () => FormControl[];
  constructor(list: () => FormControl[]) {
    super();
    this.list = list;
  }
  private pick(key: VbaValue): FormControl {
    const v = scalar(key);
    const controls = this.list();
    if (typeof v === 'number') {
      const control = controls[toInteger(v)];
      if (!control) throw new VbaError(9, `Không có điều khiển thứ ${v}`);
      return control;
    }
    const name = toStr(v).toLowerCase();
    const control = controls.find((item) => item.name.toLowerCase() === name);
    if (!control) throw new VbaError(9, `Không có điều khiển tên "${toStr(v)}"`);
    return control;
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'count') return this.list().length;
    if (name === 'item') return this.pick(arg(args, 0));
    return super.get(name, args);
  }
  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return super.defaultGet(args);
    return this.pick(args.values[0]);
  }
  items(): VbaValue[] {
    return this.list();
  }
}

export class FormControl extends VbaObject {
  readonly typeName: string;
  readonly form: UserFormInstance;
  readonly def: VbaFormControlDef;
  readonly type: VbaFormControlType;
  readonly parent: FormControl | null;
  readonly children: FormControl[] = [];
  name: string;
  caption: string;
  text: string;
  checked: boolean | null;
  number: number;
  rows: string[][] = [];
  listIndex = -1;
  selected: boolean[] = [];
  columnCount = 1;
  boundColumn = 1;
  multiSelect = 0;
  visible: boolean;
  enabled: boolean;
  locked: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  tag: string;
  tip: string;
  min = 0;
  max = 100;
  smallChange = 1;
  largeChange = 1;
  maxLength = 0;
  foreColor?: number;
  backColor?: number;
  font: { name?: string; size?: number; bold?: boolean; italic?: boolean; underline?: boolean };
  groupName: string;
  isDefault: boolean;
  isCancel: boolean;
  passwordChar: string;
  multiLine: boolean;
  rowSource: string;

  constructor(form: UserFormInstance, def: VbaFormControlDef, parent: FormControl | null) {
    super();
    this.form = form;
    this.def = def;
    this.type = def.type;
    this.parent = parent;
    this.typeName = TYPE_NAMES[def.type] ?? 'Control';
    this.name = def.name;
    this.caption = def.caption ?? (def.type === 'commandbutton' || TOGGLE_TYPES.has(def.type) ? def.name : '');
    this.text = TOGGLE_TYPES.has(def.type) ? '' : def.value ?? '';
    this.checked = TOGGLE_TYPES.has(def.type) ? def.value === '1' : null;
    this.number = Number(def.value) || 0;
    this.visible = def.visible;
    this.enabled = def.enabled;
    this.locked = !!def.locked;
    this.left = def.left;
    this.top = def.top;
    this.width = def.width;
    this.height = def.height;
    this.tag = def.tag ?? '';
    this.tip = def.tip ?? '';
    this.foreColor = def.foreColor;
    this.backColor = def.backColor;
    this.font = { ...(def.font ?? {}) };
    this.groupName = def.groupName ?? '';
    this.isDefault = !!def.isDefault;
    this.isCancel = !!def.isCancel;
    this.passwordChar = def.passwordChar ?? '';
    this.multiLine = !!def.multiLine;
    this.rowSource = def.rowSource ?? '';
    if (def.type === 'scrollbar' || def.type === 'spinbutton') this.max = 100;
  }

  get isList(): boolean {
    return MS_FORMS_LIST_TYPES.has(this.type);
  }

  hasMember(name: string): boolean {
    return CONTROL_MEMBERS.has(name) || (this.type === 'frame' && this.children.some((child) => child.name.toLowerCase() === name));
  }

  private columnValue(row: number, column: number): VbaValue {
    const values = this.rows[row];
    if (!values) throw new VbaError(381, `Không có dòng ${row} trong danh sách`);
    const value = values[column];
    return value === undefined ? null : value;
  }

  value(): VbaValue {
    if (TOGGLE_TYPES.has(this.type)) return this.checked;
    if (this.type === 'spinbutton' || this.type === 'scrollbar') return this.number;
    if (this.type === 'listbox') {
      if (this.listIndex < 0) return null;
      return this.columnValue(this.listIndex, this.boundColumn - 1);
    }
    if (this.type === 'combobox' && this.listIndex >= 0 && this.rows[this.listIndex]) return this.columnValue(this.listIndex, this.boundColumn - 1);
    return this.text;
  }

  displayText(): string {
    if (this.isList && this.listIndex >= 0 && this.rows[this.listIndex]) return this.rows[this.listIndex][0] ?? '';
    return this.text;
  }

  setValue(value: VbaValue, fromUser = false) {
    if (TOGGLE_TYPES.has(this.type)) {
      const next = value === null ? null : toBool(value ?? false);
      if (next === this.checked) return;
      this.checked = next;
      if (next && this.type === 'optionbutton') this.form.clearGroup(this);
      this.form.session.touch();
      this.form.fireControl(this, 'Change');
      this.form.fireControl(this, 'Click');
      return;
    }
    if (this.type === 'spinbutton' || this.type === 'scrollbar') {
      const next = Math.min(this.max, Math.max(this.min, toInteger(value ?? 0)));
      if (next === this.number) return;
      this.number = next;
      this.form.session.touch();
      this.form.fireControl(this, 'Change');
      return;
    }
    const text = value === null || value === undefined ? '' : toStr(value);
    if (this.isList) {
      const column = this.type === 'listbox' ? this.boundColumn - 1 : 0;
      const index = this.rows.findIndex((row) => (row[column] ?? '') === text);
      this.setListIndex(index, fromUser, text);
      return;
    }
    if (text === this.text) return;
    this.text = this.maxLength > 0 ? text.slice(0, this.maxLength) : text;
    this.form.session.touch();
    this.form.fireControl(this, 'Change');
  }

  setListIndex(index: number, _fromUser = false, freeText?: string) {
    if (index < -1 || index >= this.rows.length) throw new VbaError(380, `ListIndex ${index} nằm ngoài danh sách (0 đến ${this.rows.length - 1})`);
    const nextText = index >= 0 ? this.rows[index][0] ?? '' : freeText ?? (this.type === 'combobox' ? this.text : '');
    if (index === this.listIndex && nextText === this.text) return;
    this.listIndex = index;
    this.text = nextText;
    if (this.type === 'listbox' && !this.multiSelect) this.selected = this.rows.map((_, i) => i === index);
    this.form.session.touch();
    this.form.fireControl(this, 'Change');
    this.form.fireControl(this, 'Click');
  }

  toggleSelected(index: number, value: boolean) {
    if (index < 0 || index >= this.rows.length) throw new VbaError(381, `Không có dòng ${index} trong danh sách`);
    if (!this.multiSelect) {
      this.setListIndex(value ? index : -1);
      return;
    }
    this.selected[index] = value;
    this.listIndex = index;
    this.form.session.touch();
    this.form.fireControl(this, 'Change');
  }

  private addItem(args: VbaArgs) {
    if (!this.isList) throw new VbaError(438, `${this.typeName} không có AddItem`);
    if (this.rowSource) throw new VbaError(70, 'Không AddItem được khi danh sách lấy từ RowSource');
    const text = isMissing(args.values[0]) ? '' : toStr(args.values[0]);
    const at = isMissing(args.values[1]) ? this.rows.length : toInteger(args.values[1]);
    if (at < 0 || at > this.rows.length) throw new VbaError(381, `Không chèn được vào vị trí ${at}`);
    this.rows.splice(at, 0, [text]);
    this.selected.splice(at, 0, false);
    if (this.listIndex >= at) this.listIndex += 1;
    this.form.session.touch();
  }

  private removeItem(index: number) {
    if (index < 0 || index >= this.rows.length) throw new VbaError(381, `Không có dòng ${index} trong danh sách`);
    this.rows.splice(index, 1);
    this.selected.splice(index, 1);
    if (this.listIndex === index) this.setListIndex(-1);
    else if (this.listIndex > index) this.listIndex -= 1;
    this.form.session.touch();
  }

  clearList() {
    this.rows = [];
    this.selected = [];
    const changed = this.listIndex !== -1;
    this.listIndex = -1;
    if (this.type === 'combobox') this.text = '';
    this.form.session.touch();
    if (changed) this.form.fireControl(this, 'Change');
  }

  private setList(value: VbaValue) {
    if (value instanceof VbaArray) {
      const grid = value.bounds.length === 1 ? value.data.map((item) => [item]) : value.rows();
      this.rows = grid.map((row) => row.map((cell) => (cell === undefined || cell === null ? '' : toStr(cell as VbaValue))));
    } else if (isMissing(value) || value === null) this.rows = [];
    else this.rows = [[toStr(value)]];
    this.selected = this.rows.map(() => false);
    this.listIndex = -1;
    if (this.rows.some((row) => row.length > this.columnCount)) this.columnCount = Math.max(...this.rows.map((row) => row.length));
    this.form.session.touch();
  }

  loadRowSource() {
    if (!this.isList || !this.rowSource) return;
    const read = this.form.session.callbacks.readRange;
    if (!read) return;
    try {
      this.rows = read(this.rowSource).map((row) => row.map((cell) => (cell === undefined || cell === null ? '' : toStr(cell))));
      this.selected = this.rows.map(() => false);
    } catch (error) {
      this.form.session.callbacks.report?.(error);
    }
  }

  private listGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return VbaArray.fromGrid(this.rows.map((row) => row.map((cell) => cell)));
    const row = toInteger(args.values[0]);
    const column = isMissing(args.values[1]) ? 0 : toInteger(args.values[1]);
    return this.columnValue(row, column);
  }

  get(name: string, args: VbaArgs): VbaValue {
    switch (name) {
      case 'name':
        return this.name;
      case 'value':
        return this.value();
      case 'text':
        return this.displayText();
      case 'caption':
        return this.caption;
      case 'visible':
        return this.visible;
      case 'enabled':
        return this.enabled;
      case 'locked':
        return this.locked;
      case 'left':
        return this.left;
      case 'top':
        return this.top;
      case 'width':
        return this.width;
      case 'height':
        return this.height;
      case 'tag':
        return this.tag;
      case 'controltiptext':
        return this.tip;
      case 'forecolor':
        return this.foreColor ?? 0;
      case 'backcolor':
        return this.backColor ?? 0xffffff;
      case 'font':
        return new FontObject(this);
      case 'parent':
        return this.parent ?? this.form;
      case 'object':
        return this;
      case 'tabindex':
        return this.def.tabIndex;
      case 'groupname':
        return this.groupName;
      case 'default':
        return this.isDefault;
      case 'cancel':
        return this.isCancel;
      case 'min':
        return this.min;
      case 'max':
        return this.max;
      case 'smallchange':
        return this.smallChange;
      case 'largechange':
        return this.largeChange;
      case 'maxlength':
        return this.maxLength;
      case 'multiline':
        return this.multiLine;
      case 'passwordchar':
        return this.passwordChar;
      case 'listcount':
        return this.rows.length;
      case 'listindex':
        return this.listIndex;
      case 'columncount':
        return this.columnCount;
      case 'boundcolumn':
        return this.boundColumn;
      case 'multiselect':
        return this.multiSelect;
      case 'rowsource':
        return this.rowSource;
      case 'list':
        return this.listGet(args);
      case 'column': {
        const column = toInteger(arg(args, 0));
        const row = isMissing(args.values[1]) ? this.listIndex : toInteger(args.values[1]);
        return this.columnValue(row, column);
      }
      case 'selected':
        return !!this.selected[toInteger(arg(args, 0))];
      case 'additem':
        this.addItem(args);
        return undefined;
      case 'removeitem':
        this.removeItem(toInteger(arg(args, 0)));
        return undefined;
      case 'clear':
        this.clearList();
        return undefined;
      case 'setfocus':
        this.form.focus = this;
        this.form.session.touch();
        return undefined;
      case 'selstart':
      case 'sellength':
        return name === 'selstart' ? this.text.length : 0;
      case 'seltext':
        return '';
      case 'controls':
        return new ControlsCollection(() => this.children);
      case 'repaint':
        return undefined;
    }
    const child = this.children.find((item) => item.name.toLowerCase() === name);
    if (child) return child;
    return super.get(name, args);
  }

  set(name: string, args: VbaArgs, value: VbaValue): boolean {
    const touch = () => {
      this.form.session.touch();
      return true;
    };
    switch (name) {
      case 'value':
        this.setValue(value);
        return true;
      case 'text':
        if (this.isList) this.setValue(value);
        else this.setValue(value);
        return true;
      case 'caption':
        this.caption = toStr(value);
        return touch();
      case 'visible':
        this.visible = toBool(value ?? false);
        return touch();
      case 'enabled':
        this.enabled = toBool(value ?? false);
        return touch();
      case 'locked':
        this.locked = toBool(value ?? false);
        return touch();
      case 'left':
        this.left = toNumber(value);
        return touch();
      case 'top':
        this.top = toNumber(value);
        return touch();
      case 'width':
        this.width = toNumber(value);
        return touch();
      case 'height':
        this.height = toNumber(value);
        return touch();
      case 'tag':
        this.tag = toStr(value);
        return true;
      case 'controltiptext':
        this.tip = toStr(value);
        return touch();
      case 'forecolor':
        this.foreColor = toInteger(value);
        return touch();
      case 'backcolor':
        this.backColor = toInteger(value);
        return touch();
      case 'groupname':
        this.groupName = toStr(value);
        return true;
      case 'default':
        this.isDefault = toBool(value ?? false);
        return true;
      case 'cancel':
        this.isCancel = toBool(value ?? false);
        return true;
      case 'min':
        this.min = toInteger(value);
        return true;
      case 'max':
        this.max = toInteger(value);
        return true;
      case 'smallchange':
        this.smallChange = toInteger(value);
        return true;
      case 'largechange':
        this.largeChange = toInteger(value);
        return true;
      case 'maxlength':
        this.maxLength = toInteger(value);
        return true;
      case 'multiline':
        this.multiLine = toBool(value ?? false);
        return touch();
      case 'passwordchar':
        this.passwordChar = toStr(value).slice(0, 1);
        return touch();
      case 'listindex':
        this.setListIndex(toInteger(value));
        return true;
      case 'columncount':
        this.columnCount = Math.max(1, toInteger(value));
        return touch();
      case 'boundcolumn':
        this.boundColumn = Math.max(0, toInteger(value));
        return true;
      case 'multiselect':
        this.multiSelect = toInteger(value);
        return touch();
      case 'rowsource':
        this.rowSource = toStr(value);
        this.loadRowSource();
        return touch();
      case 'list':
        if (!args.values.length) this.setList(value);
        else {
          const row = toInteger(args.values[0]);
          const column = isMissing(args.values[1]) ? 0 : toInteger(args.values[1]);
          if (!this.rows[row]) throw new VbaError(381, `Không có dòng ${row} trong danh sách`);
          this.rows[row][column] = value === null || value === undefined ? '' : toStr(value);
          this.form.session.touch();
        }
        return true;
      case 'column': {
        const column = toInteger(arg(args, 0));
        const row = isMissing(args.values[1]) ? this.listIndex : toInteger(args.values[1]);
        if (!this.rows[row]) throw new VbaError(381, `Không có dòng ${row} trong danh sách`);
        this.rows[row][column] = toStr(value);
        return touch();
      }
      case 'selected':
        this.toggleSelected(toInteger(arg(args, 0)), toBool(value ?? false));
        return true;
      case 'selstart':
      case 'sellength':
      case 'columnwidths':
      case 'columnheads':
      case 'style':
      case 'matchentry':
      case 'liststyle':
      case 'textalign':
      case 'specialeffect':
      case 'borderstyle':
      case 'wordwrap':
      case 'autosize':
      case 'picture':
      case 'tabindex':
      case 'tabstop':
      case 'mousepointer':
        return true;
    }
    return false;
  }

  defaultGet(args: VbaArgs): VbaValue {
    if (args.values.length) return super.defaultGet(args);
    return this.type === 'commandbutton' || this.type === 'label' || this.type === 'frame' ? this.caption : this.value();
  }

  defaultSet(args: VbaArgs, value: VbaValue): void {
    if (args.values.length) super.defaultSet(args, value);
    else if (this.type === 'commandbutton' || this.type === 'label' || this.type === 'frame') this.set('caption', noArgs, value);
    else this.setValue(value);
  }
}

const TYPE_NAMES: Partial<Record<VbaFormControlType, string>> = {
  label: 'Label',
  textbox: 'TextBox',
  combobox: 'ComboBox',
  listbox: 'ListBox',
  checkbox: 'CheckBox',
  optionbutton: 'OptionButton',
  togglebutton: 'ToggleButton',
  commandbutton: 'CommandButton',
  frame: 'Frame',
  image: 'Image',
  spinbutton: 'SpinButton',
  scrollbar: 'ScrollBar',
  multipage: 'MultiPage',
  tabstrip: 'TabStrip',
};

const CONTROL_MEMBERS = new Set([
  'name', 'value', 'text', 'caption', 'visible', 'enabled', 'locked', 'left', 'top', 'width', 'height', 'tag', 'controltiptext', 'forecolor', 'backcolor',
  'font', 'parent', 'object', 'tabindex', 'groupname', 'default', 'cancel', 'min', 'max', 'smallchange', 'largechange', 'maxlength', 'multiline',
  'passwordchar', 'listcount', 'listindex', 'columncount', 'boundcolumn', 'multiselect', 'rowsource', 'list', 'column', 'selected', 'additem',
  'removeitem', 'clear', 'setfocus', 'selstart', 'sellength', 'seltext', 'controls', 'repaint',
]);

export class UserFormInstance extends VbaObject {
  readonly typeName = 'UserForm';
  readonly session: UserFormSession;
  readonly def: VbaUserFormDef;
  readonly controls: FormControl[] = [];
  readonly all = new Map<string, FormControl>();
  caption: string;
  width: number;
  height: number;
  left = 0;
  top = 0;
  tag = '';
  backColor?: number;
  visible = false;
  modal = false;
  loaded = true;
  focus: FormControl | null = null;
  private waiters: Array<() => void> = [];

  constructor(session: UserFormSession, def: VbaUserFormDef) {
    super();
    this.session = session;
    this.def = def;
    this.caption = def.caption;
    this.width = def.width;
    this.height = def.height;
    this.backColor = def.backColor;
    const build = (defs: VbaFormControlDef[], parent: FormControl | null, into: FormControl[]) => {
      for (const child of [...defs].sort((a, b) => a.tabIndex - b.tabIndex)) {
        const control = new FormControl(this, child, parent);
        into.push(control);
        this.all.set(child.name.toLowerCase(), control);
        if (child.children) build(child.children, control, control.children);
      }
    };
    build(def.controls, null, this.controls);
    for (const control of this.all.values()) control.loadRowSource();
  }

  get name(): string {
    return this.def.name;
  }

  flat(): FormControl[] {
    return [...this.all.values()];
  }

  hasMember(name: string): boolean {
    return FORM_MEMBERS.has(name) || this.all.has(name);
  }

  clearGroup(source: FormControl) {
    for (const control of this.all.values()) {
      if (control === source || control.type !== 'optionbutton' || !control.checked) continue;
      const sameGroup = source.groupName ? control.groupName === source.groupName : !control.groupName && control.parent === source.parent;
      if (!sameGroup) continue;
      control.checked = false;
      this.fireControl(control, 'Change');
    }
  }

  fireControl(control: FormControl, event: string, args: Array<VbaValue | Box> = []) {
    this.session.fire(this.name, `${control.name}_${event}`, args);
  }

  show(modal: boolean) {
    if (!this.loaded) return;
    if (this.visible) return;
    this.visible = true;
    this.modal = modal;
    this.session.bringToFront(this);
    this.session.fire(this.name, 'UserForm_Activate', []);
    if (modal) this.session.callbacks.wait(new Promise<void>((resolve) => this.waiters.push(resolve)));
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.session.bringToFront(this);
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((resolve) => resolve());
  }

  async requestClose(mode = CLOSE_MODE_MENU) {
    const cancel = new Box(0, 'integer');
    if (this.session.callbacks.hasHandler(this.name, 'UserForm_QueryClose')) {
      await this.session.fire(this.name, 'UserForm_QueryClose', [cancel, mode]);
      if (toInteger(cancel.v ?? 0) !== 0) return;
    }
    this.unload(false);
  }

  unload(query = true) {
    if (!this.loaded) return;
    if (query && this.session.callbacks.hasHandler(this.name, 'UserForm_QueryClose')) {
      const cancel = new Box(0, 'integer');
      this.session.fireSync(this.name, 'UserForm_QueryClose', [cancel, CLOSE_MODE_CODE]);
      if (toInteger(cancel.v ?? 0) !== 0) return;
    }
    this.session.fireSync(this.name, 'UserForm_Terminate', []);
    this.loaded = false;
    this.hide();
    this.session.dispose(this);
  }

  load() {
    void this.loaded;
  }

  get(name: string, args: VbaArgs): VbaValue {
    switch (name) {
      case 'show': {
        const style = args.values.length && !isMissing(args.values[0]) ? toInteger(args.values[0]) : 1;
        this.show(style !== VB_MODELESS);
        return undefined;
      }
      case 'hide':
        this.hide();
        return undefined;
      case 'caption':
        return this.caption;
      case 'width':
        return this.width;
      case 'height':
        return this.height;
      case 'insidewidth':
        return this.def.width;
      case 'insideheight':
        return this.def.height;
      case 'left':
        return this.left;
      case 'top':
        return this.top;
      case 'name':
        return this.name;
      case 'tag':
        return this.tag;
      case 'visible':
        return this.visible;
      case 'backcolor':
        return this.backColor ?? 0x8000000f;
      case 'startupposition':
        return this.def.startUpPosition ?? 1;
      case 'controls':
        return new ControlsCollection(() => this.flat());
      case 'activecontrol':
        return this.focus ?? undefined;
      case 'repaint':
      case 'printform':
      case 'setfocus':
      case 'scrollheight':
      case 'scrollwidth':
        return undefined;
    }
    const control = this.all.get(name);
    if (control) return args.values.length ? control.defaultGet(args) : control;
    return super.get(name, args);
  }

  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    switch (name) {
      case 'caption':
        this.caption = toStr(value);
        break;
      case 'width':
        this.width = toNumber(value);
        break;
      case 'height':
        this.height = toNumber(value);
        break;
      case 'left':
        this.left = toNumber(value);
        break;
      case 'top':
        this.top = toNumber(value);
        break;
      case 'tag':
        this.tag = toStr(value);
        break;
      case 'backcolor':
        this.backColor = toInteger(value);
        break;
      case 'startupposition':
      case 'scrollheight':
      case 'scrollwidth':
        break;
      default: {
        const control = this.all.get(name);
        if (!control) return false;
        control.defaultSet(noArgs, value);
      }
    }
    this.session.touch();
    return true;
  }

  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return super.defaultGet(args);
    return new ControlsCollection(() => this.flat()).defaultGet(args);
  }
}

export class UserFormSession {
  readonly callbacks: UserFormCallbacks;
  private readonly defs = new Map<string, VbaUserFormDef>();
  private readonly instances = new Map<string, UserFormInstance>();
  private order: UserFormInstance[] = [];
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(defs: VbaUserFormDef[], callbacks: UserFormCallbacks) {
    this.callbacks = callbacks;
    for (const def of defs) this.defs.set(def.name.toLowerCase(), def);
  }

  has(name: string): boolean {
    return this.defs.has(name.toLowerCase());
  }

  instance(name: string): UserFormInstance | null {
    const key = name.toLowerCase();
    const existing = this.instances.get(key);
    if (existing) return existing;
    const def = this.defs.get(key);
    if (!def) return null;
    const created = new UserFormInstance(this, def);
    this.instances.set(key, created);
    this.fireSync(def.name, 'UserForm_Initialize', []);
    return created;
  }

  dispose(instance: UserFormInstance) {
    const key = instance.name.toLowerCase();
    if (this.instances.get(key) === instance) this.instances.delete(key);
    this.order = this.order.filter((item) => item !== instance);
    this.callbacks.resetModule(instance.name);
    this.touch();
  }

  bringToFront(instance: UserFormInstance) {
    this.order = this.order.filter((item) => item !== instance);
    if (instance.visible) this.order.push(instance);
    this.touch();
  }

  visibleForms(): UserFormInstance[] {
    return this.order.filter((item) => item.visible);
  }

  fire(module: string, proc: string, args: Array<VbaValue | Box>): Promise<unknown> {
    if (!this.callbacks.hasHandler(module, proc)) return Promise.resolve();
    return this.callbacks.fire(module, proc, args).catch((error) => this.callbacks.report?.(error));
  }

  fireSync(module: string, proc: string, args: Array<VbaValue | Box>) {
    void this.fire(module, proc, args);
  }

  closeAll() {
    for (const instance of [...this.instances.values()]) {
      instance.loaded = false;
      instance.hide();
      this.dispose(instance);
    }
  }

  touch() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;
}

