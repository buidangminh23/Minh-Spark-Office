import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { workspaceLifecycle } from '../lib/workspaceLifecycle';

type Field = { name: string; label: string; type?: 'text' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox'; value?: string | number | boolean; options?: { value: string; label: string }[]; placeholder?: string; min?: number; max?: number };

export type DialogRequest = {
  title: string;
  message?: ReactNode;
  fields?: Field[];
  confirmText?: string;
  cancelText?: string | null;
  danger?: boolean;
  wide?: boolean;
  body?: ReactNode;
  validate?: (values: Record<string, string | boolean>) => string | null | Promise<string | null>;
};

type ToastItem = { id: number; text: string; error?: boolean };

type UiContextValue = {
  ask: (request: DialogRequest) => Promise<Record<string, string | boolean> | null>;
  confirm: (title: string, message?: ReactNode, danger?: boolean) => Promise<boolean>;
  toast: (text: string, error?: boolean) => void;
  showBusy: (text: string | null) => void;
};

const UiContext = createContext<UiContextValue | null>(null);

export const useUi = () => {
  const value = useContext(UiContext);
  if (!value) throw new Error('UiContext missing');
  return value;
};

function DialogView({ request, onDone }: { request: DialogRequest; onDone: (values: Record<string, string | boolean> | null) => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => Object.fromEntries((request.fields ?? []).map((field) => [field.name, field.type === 'checkbox' ? Boolean(field.value) : String(field.value ?? '')])));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const firstInput = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    const target = firstInput.current;
    if (target) {
      target.focus();
      if (target instanceof HTMLInputElement && target.type === 'text') target.select();
    }
  }, []);

  const submit = async () => {
    if (pending) return;
    if (request.validate) {
      setPending(true);
      const message = await request.validate(values);
      setPending(false);
      if (message) {
        setError(message);
        return;
      }
    }
    onDone(values);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && request.cancelText !== null && onDone(null)}>
      <section className={`dialog ${request.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && request.cancelText !== null) onDone(null);
          if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); void submit(); }
        }}>
        {request.cancelText !== null && <button className="dialog-close icon-btn" onClick={() => onDone(null)} aria-label="Đóng"><X size={18} /></button>}
        <h2 id="dialog-title">{request.title}</h2>
        {request.message && <div className="dialog-subtitle">{request.message}</div>}
        {request.body}
        {(request.fields ?? []).map((field, index) => (
          <label key={field.name} className={field.type === 'checkbox' ? 'check-field' : 'field'}>
            {field.type === 'checkbox' ? (
              <>
                <input type="checkbox" checked={Boolean(values[field.name])} onChange={(event) => setValues({ ...values, [field.name]: event.target.checked })} />
                <span>{field.label}</span>
              </>
            ) : (
              <>
                <span className="field-label">{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea ref={index === 0 ? (node) => { firstInput.current = node; } : undefined} className="text-field" rows={4} value={String(values[field.name])} placeholder={field.placeholder} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />
                ) : field.type === 'select' ? (
                  <select ref={index === 0 ? (node) => { firstInput.current = node; } : undefined} className="text-field" value={String(values[field.name])} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>
                    {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input ref={index === 0 ? (node) => { firstInput.current = node; } : undefined} className="text-field" type={field.type ?? 'text'} min={field.min} max={field.max} value={String(values[field.name])} placeholder={field.placeholder} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />
                )}
              </>
            )}
          </label>
        ))}
        <div className="form-error" role="alert">{error}</div>
        <div className="dialog-actions">
          {request.cancelText !== null && <button className="btn" onClick={() => onDone(null)}>{request.cancelText ?? 'Hủy'}</button>}
          <button className={`btn ${request.danger ? 'btn-danger' : 'btn-primary'}`} disabled={pending} onClick={() => void submit()}>{pending ? 'Đang xử lý…' : request.confirmText ?? 'Đồng ý'}</button>
        </div>
      </section>
    </div>
  );
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<{ id: number; request: DialogRequest; resolve: (value: Record<string, string | boolean> | null) => void }[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const busyOwner = useRef(Symbol('workspace-ui'));
  const showBusy = useCallback((text: string | null) => {
    workspaceLifecycle.setBusy(busyOwner.current, text !== null);
    setBusy(text);
  }, []);
  useEffect(() => {
    const owner = busyOwner.current;
    return () => workspaceLifecycle.setBusy(owner, false);
  }, []);
  const counter = useRef(0);

  const ask = useCallback((request: DialogRequest) => new Promise<Record<string, string | boolean> | null>((resolve) => {
    const id = ++counter.current;
    setDialogs((items) => [...items, { id, request, resolve }]);
  }), []);

  const confirm = useCallback(async (title: string, message?: ReactNode, danger?: boolean) => Boolean(await ask({ title, message, danger, confirmText: danger ? 'Xóa' : 'Đồng ý' })), [ask]);

  const toast = useCallback((text: string, error?: boolean) => {
    const id = ++counter.current;
    setToasts((items) => [...items.slice(-3), { id, text, error }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), error ? 6000 : 3200);
  }, []);

  return (
    <UiContext.Provider value={{ ask, confirm, toast, showBusy }}>
      {children}
      {dialogs.map((dialog) => (
        <DialogView key={dialog.id} request={dialog.request} onDone={(value) => {
          setDialogs((items) => items.filter((item) => item.id !== dialog.id));
          dialog.resolve(value);
        }} />
      ))}
      {busy && <div className="busy-overlay" role="status"><div className="busy-card"><span className="spinner" />{busy}</div></div>}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast ${item.error ? 'error' : ''}`}>
            {item.error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {item.text}
          </div>
        ))}
      </div>
    </UiContext.Provider>
  );
}
