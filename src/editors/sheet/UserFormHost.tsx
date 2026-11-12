import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { oleColorToCss } from '../../lib/vbaForms';
import ComboBox from '../../components/ComboBox';
import { ReturnBoolean, type FormControl, type UserFormInstance, type UserFormSession } from './vba/vbaUserForm';

const PX_PER_POINT = 4 / 3;
const px = (points: number) => Math.round(points * PX_PER_POINT);
const BASE_Z = 2400;

const fontStyle = (control: FormControl): CSSProperties => ({
  fontFamily: control.font.name ? `"${control.font.name}", Tahoma, "Segoe UI", sans-serif` : 'Tahoma, "Segoe UI", sans-serif',
  fontSize: px(control.font.size ?? 8.25),
  fontWeight: control.font.bold ? 700 : 400,
  fontStyle: control.font.italic ? 'italic' : 'normal',
  textDecoration: control.font.underline ? 'underline' : 'none',
  color: oleColorToCss(control.foreColor, '#000000'),
});

const boxStyle = (control: FormControl): CSSProperties => ({
  position: 'absolute',
  left: px(control.left),
  top: px(control.top),
  width: px(control.width),
  height: px(control.height),
  boxSizing: 'border-box',
  display: control.visible ? undefined : 'none',
});

const focusValues = new WeakMap<FormControl, unknown>();

function guard(action: () => void) {
  try {
    action();
  } catch (error) {
    console.warn('UserForm action failed:', error);
  }
}

function ControlView({ control }: { control: FormControl }): ReactNode {
  const form = control.form;
  const disabled = !control.enabled;
  const base = { ...boxStyle(control), ...fontStyle(control) };
  const focusHandlers = {
    onFocus: () => {
      form.focus = control;
      focusValues.set(control, control.value());
      form.fireControl(control, 'Enter');
    },
    onBlur: () => {
      if (focusValues.has(control) && focusValues.get(control) !== control.value()) form.fireControl(control, 'AfterUpdate');
      focusValues.delete(control);
      form.fireControl(control, 'Exit', [new ReturnBoolean()]);
    },
  };
  switch (control.type) {
    case 'label':
      return (
        <div style={{ ...base, background: control.backColor === undefined ? 'transparent' : oleColorToCss(control.backColor, 'transparent'), whiteSpace: 'pre-wrap', overflow: 'hidden', lineHeight: 1.2 }} title={control.tip || undefined} onClick={() => !disabled && form.fireControl(control, 'Click')}>
          {control.caption}
        </div>
      );
    case 'commandbutton':
    case 'togglebutton': {
      const pressed = control.type === 'togglebutton' && !!control.checked;
      return (
        <button
          type="button"
          disabled={disabled}
          title={control.tip || undefined}
          style={{ ...base, background: pressed ? '#cfd8e3' : oleColorToCss(control.backColor, '#f0f0f0'), border: control.isDefault ? '2px solid #0078d7' : '1px solid #adadad', borderRadius: 2, padding: '0 4px', cursor: disabled ? 'default' : 'pointer' }}
          onClick={() => guard(() => (control.type === 'togglebutton' ? control.setValue(!control.checked, true) : form.fireControl(control, 'Click')))}
          {...focusHandlers}
        >
          {control.caption}
        </button>
      );
    }
    case 'textbox': {
      const common = {
        value: control.text,
        disabled,
        readOnly: control.locked,
        title: control.tip || undefined,
        onChange: (event: { target: { value: string } }) => guard(() => control.setValue(event.target.value, true)),
        style: { ...base, border: '1px solid #7a7a7a', padding: '1px 3px', background: oleColorToCss(control.backColor, '#ffffff'), resize: 'none' as const },
        ...focusHandlers,
      };
      if (control.multiLine) return <textarea {...common} />;
      return <input {...common} type={control.passwordChar ? 'password' : 'text'} maxLength={control.maxLength || undefined} />;
    }
    case 'combobox': {
      return (
        <ComboBox
          variant="plain"
          label={control.tip || control.name}
          value={control.displayText()}
          options={control.rows.map((row) => row[0] ?? '')}
          disabled={disabled}
          readOnly={control.locked}
          style={{ ...base, border: '1px solid #7a7a7a', background: oleColorToCss(control.backColor, '#ffffff') }}
          onInput={(value) => guard(() => control.setValue(value, true))}
          onCommit={(value) => guard(() => control.setValue(value, true))}
          {...focusHandlers}
        />
      );
    }
    case 'listbox':
      return (
        <div role="listbox" tabIndex={disabled ? -1 : 0} title={control.tip || undefined} style={{ ...base, border: '1px solid #7a7a7a', background: oleColorToCss(control.backColor, '#ffffff'), overflow: 'auto' }} {...focusHandlers}>
          {control.rows.map((row, index) => {
            const isSelected = control.multiSelect ? !!control.selected[index] : control.listIndex === index;
            return (
              <div
                key={index}
                role="option"
                aria-selected={isSelected}
                style={{ display: 'flex', gap: 8, padding: '1px 3px', background: isSelected ? '#0078d7' : undefined, color: isSelected ? '#ffffff' : undefined, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => !disabled && guard(() => (control.multiSelect ? control.toggleSelected(index, !control.selected[index]) : control.setListIndex(index, true)))}
                onDoubleClick={() => !disabled && form.fireControl(control, 'DblClick', [new ReturnBoolean()])}
              >
                {row.slice(0, Math.max(1, control.columnCount)).map((cell, column) => (
                  <span key={column} style={{ minWidth: 40 }}>
                    {cell}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      );
    case 'checkbox':
    case 'optionbutton':
      return (
        <label title={control.tip || undefined} style={{ ...base, display: control.visible ? 'flex' : 'none', alignItems: 'center', gap: 4, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
          <input
            type={control.type === 'checkbox' ? 'checkbox' : 'radio'}
            checked={!!control.checked}
            disabled={disabled || control.locked}
            onChange={() => guard(() => control.setValue(control.type === 'optionbutton' ? true : !control.checked, true))}
            {...focusHandlers}
          />
          <span>{control.caption}</span>
        </label>
      );
    case 'frame':
      return (
        <fieldset style={{ ...base, margin: 0, padding: 0, border: '1px solid #b9b9b9', borderRadius: 2 }}>
          {control.caption ? <legend style={{ marginLeft: 6, padding: '0 2px', fontSize: 'inherit' }}>{control.caption}</legend> : null}
          <div style={{ position: 'absolute', inset: 0 }}>
            {control.children.map((child) => (
              <ControlView key={child.name} control={child} />
            ))}
          </div>
        </fieldset>
      );
    case 'spinbutton':
    case 'scrollbar':
      return (
        <input
          type={control.type === 'scrollbar' ? 'range' : 'number'}
          min={control.min}
          max={control.max}
          step={control.smallChange || 1}
          value={control.number}
          disabled={disabled}
          style={base}
          onChange={(event) => guard(() => control.setValue(Number(event.target.value), true))}
          {...focusHandlers}
        />
      );
    default:
      return <div style={{ ...base, border: '1px dashed #9a9a9a', background: '#f7f7f7', color: '#666', fontSize: 11, padding: 2, overflow: 'hidden' }}>{control.name}</div>;
  }
}

function FormWindow({ form, index, active }: { form: UserFormInstance; index: number; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, button, [role=listbox]');
    first?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') {
      const cancel = form.flat().find((control) => control.isCancel && control.enabled && control.visible);
      event.preventDefault();
      if (cancel) form.fireControl(cancel, 'Click');
      else void form.requestClose();
    } else if (event.key === 'Enter' && target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON') {
      const button = form.flat().find((control) => control.isDefault && control.enabled && control.visible);
      if (button) {
        event.preventDefault();
        form.fireControl(button, 'Click');
      }
    }
  };
  const width = px(form.def.width);
  const height = px(form.def.height);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: BASE_Z + index, display: 'flex', alignItems: 'center', justifyContent: 'center', background: form.modal && active ? 'rgba(15, 23, 42, 0.18)' : 'transparent', pointerEvents: form.modal || active ? 'auto' : 'none' }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal={form.modal}
        aria-label={form.caption}
        onKeyDown={onKeyDown}
        style={{ pointerEvents: 'auto', background: oleColorToCss(form.backColor, '#f0f0f0'), border: '1px solid #8a8a8a', boxShadow: '0 12px 40px rgba(0,0,0,0.28)', borderRadius: 6, overflow: 'hidden', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 12px', background: '#ffffff', borderBottom: '1px solid #e2e2e2', fontSize: 13, fontFamily: '"Segoe UI", Tahoma, sans-serif' }}>
          <span data-no-translate style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.caption}</span>
          <button type="button" aria-label="Đóng" onClick={() => void form.requestClose()} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 28, height: 24, borderRadius: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div data-no-translate style={{ position: 'relative', width, height, overflow: 'auto' }}>
          {form.controls.map((control) => (
            <ControlView key={control.name} control={control} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function UserFormHost({ session }: { session: UserFormSession | null }) {
  const subscribe = session?.subscribe ?? (() => () => undefined);
  const getVersion = session?.getVersion ?? (() => 0);
  useSyncExternalStore(subscribe, getVersion);
  if (!session) return null;
  const forms = session.visibleForms();
  return (
    <>
      {forms.map((form, index) => (
        <FormWindow key={form.name} form={form} index={index} active={index === forms.length - 1} />
      ))}
    </>
  );
}
