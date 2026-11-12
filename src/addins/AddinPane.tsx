import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Check, Copy, KeyRound, LogIn, RotateCcw, Settings, Square, X } from 'lucide-react';
import { MAX_TURNS, type AddinApp, type AddinContext, type AddinProvider, type AddinTurn } from '../../api/_shared/addin';
import { useAccount } from '../components/Authentication';
import { AddinError, getProviderKey, resolveMode, setProviderKey, streamAddin } from './client';
import { renderMarkdown } from './markdown';
import { ADDIN_INFO, closeAddin, toggleAddin, useOpenAddin } from './store';
import './addins.css';
import { useSettings, type AppSettings } from '../lib/appSettings';

const addinEnabled = (provider: AddinProvider, settings: AppSettings) => (provider === 'claude' ? settings.addinClaude : settings.addinChatgpt);

export type AddinAction = {
  id: string;
  label: string;
  icon: ReactNode;
  isAvailable?: (text: string) => boolean;
  run: (text: string) => string | void;
};

export type AddinHost = {
  app: AddinApp;
  documentName: string;
  describeContext: () => string;
  readContext: () => AddinContext | Promise<AddinContext>;
  actions: AddinAction[];
  suggestions: string[];
};

type Message = { id: string; role: 'user' | 'assistant'; content: string; error?: string; streaming?: boolean };

const CONTEXT_REFRESH_MS = 1000;
const newId = () => Math.random().toString(36).slice(2, 10);

function historyFor(messages: Message[]): AddinTurn[] {
  const turns = messages.filter((message) => !message.error && message.content.trim()).map(({ role, content }) => ({ role, content }));
  let start = Math.max(0, turns.length - (MAX_TURNS - 1));
  while (start < turns.length && turns[start].role !== 'user') start += 1;
  return turns.slice(start);
}

export function AddinPanel({ host }: { host: AddinHost }) {
  const open = useOpenAddin();
  const settings = useSettings();
  const provider = open && addinEnabled(open, settings) ? open : null;
  useEffect(() => closeAddin, []);
  if (!provider) return null;
  return <AddinPane key={provider} provider={provider} host={host} />;
}

function AddinPane({ provider, host }: { provider: AddinProvider; host: AddinHost }) {
  const info = ADDIN_INFO[provider];
  const { user, login } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const [contextLabel, setContextLabel] = useState(() => host.describeContext());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [, setKeyVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const describeRef = useRef(host.describeContext);
  useEffect(() => {
    describeRef.current = host.describeContext;
  }, [host]);

  const mode = resolveMode(provider, Boolean(user));

  useEffect(() => {
    const timer = window.setInterval(() => setContextLabel(describeRef.current()), CONTEXT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const patchLast = useCallback((patch: (message: Message) => Message) => {
    setMessages((items) => items.map((item, index) => (index === items.length - 1 ? patch(item) : item)));
  }, []);

  const send = useCallback(async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const userMessage: Message = { id: newId(), role: 'user', content: prompt };
    const history = historyFor([...messages, userMessage]);
    setMessages((items) => [...items, userMessage, { id: newId(), role: 'assistant', content: '', streaming: true }]);
    setDraft('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const context = useContext ? await host.readContext() : { label: 'Không gửi kèm', text: '' };
      const left = await streamAddin({ provider, app: host.app, documentName: host.documentName, turns: history, context }, (chunk) => {
        patchLast((message) => ({ ...message, content: message.content + chunk }));
      }, controller.signal);
      if (left !== null) setRemaining(left);
      patchLast((message) => ({ ...message, streaming: false }));
    } catch (error) {
      const aborted = controller.signal.aborted || (error instanceof AddinError && error.code === 'aborted');
      const reason = aborted ? 'Đã dừng.' : error instanceof Error ? error.message : 'Không trả lời được.';
      patchLast((message) => ({ ...message, streaming: false, error: message.content && aborted ? undefined : reason }));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [busy, host, messages, patchLast, provider, useContext]);

  const stop = () => abortRef.current?.abort();
  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
  };

  return (
    <aside className="addin-pane" aria-label={`Add-in ${info.name}`} style={{ ['--addin-accent' as string]: info.color }}>
      <header className="addin-head">
        <img src={info.logo} alt="" className="addin-logo" />
        <div className="addin-title">
          <strong>{info.name}</strong>
          <span className={`addin-mode addin-mode-${mode}`}>{mode === 'own-key' ? 'API key riêng' : mode === 'account' ? 'Tài khoản Google' : 'Chưa kết nối'}</span>
        </div>
        <button type="button" className="icon-btn" title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới" disabled={!messages.length} onClick={reset}><RotateCcw size={15} /></button>
        <button type="button" className={`icon-btn ${showSettings ? 'active' : ''}`} title="Cài đặt add-in" aria-label="Cài đặt add-in" aria-pressed={showSettings} onClick={() => setShowSettings((value) => !value)}><Settings size={15} /></button>
        <button type="button" className="icon-btn" title="Đóng" aria-label="Đóng add-in" onClick={closeAddin}><X size={16} /></button>
      </header>

      {showSettings ? (
        <AddinSettings provider={provider} signedIn={Boolean(user)} onLogin={login} onSaved={() => setKeyVersion((value) => value + 1)} onDone={() => setShowSettings(false)} />
      ) : mode === 'none' ? (
        <AddinWelcome provider={provider} app={host.app} onLogin={() => void login()} onUseKey={() => setShowSettings(true)} />
      ) : (
        <>
          <div className="addin-messages" ref={listRef}>
            {!messages.length && (
              <div className="addin-empty">
                <p>Hỏi {info.name} về tệp đang mở. Nội dung đang chọn được gửi kèm câu hỏi.</p>
                <div className="addin-suggestions">
                  {host.suggestions.map((item) => <button type="button" key={item} className="addin-chip" onClick={() => void send(item)}>{item}</button>)}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <MessageView key={message.id} message={message} actions={host.actions} />
            ))}
          </div>

          <form className="addin-compose" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
            <label className="addin-context">
              <input type="checkbox" checked={useContext} onChange={(event) => setUseContext(event.target.checked)} />
              <span>Gửi kèm: <b>{contextLabel}</b></span>
            </label>
            <div className="addin-input">
              <textarea
                value={draft}
                rows={3}
                placeholder={`Nhắn cho ${info.name}…`}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              {busy ? (
                <button type="button" className="addin-send" title="Dừng" aria-label="Dừng" onClick={stop}><Square size={14} /></button>
              ) : (
                <button type="submit" className="addin-send" title="Gửi (Enter)" aria-label="Gửi" disabled={!draft.trim()}><ArrowUp size={16} /></button>
              )}
            </div>
            {mode === 'account' && remaining !== null && <div className="addin-quota">Còn {remaining} lượt miễn phí hôm nay</div>}
          </form>
        </>
      )}
    </aside>
  );
}

const WELCOME: Record<AddinApp, { place: string; text: string }> = {
  doc: { place: 'tài liệu', text: 'Viết, sửa, tóm tắt và dịch văn bản, chèn kết quả ngay vào tài liệu.' },
  sheet: { place: 'bảng tính', text: 'Phân tích dữ liệu, viết công thức và tìm lỗi, ghi kết quả thẳng vào ô.' },
  pdf: { place: 'tệp PDF', text: 'Tóm tắt, hỏi đáp và trích ý chính kèm số trang từ tệp PDF.' },
};

function WelcomeArt({ app }: { app: AddinApp }) {
  const page = app === 'sheet'
    ? <><rect x="8" y="10" width="72" height="56" rx="3" /><path d="M8 24h72M8 38h72M8 52h72M30 10v56M56 10v56" /></>
    : <><path d="M18 6h40l16 16v50a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" /><path d="M58 6v16h16" />{app === 'pdf' ? <text x="25" y="40" fontSize="13" fontWeight="700" stroke="none" fill="currentColor">PDF</text> : <path d="M26 34h34M26 44h34M26 54h22" />}</>;
  const badge = app === 'sheet' ? <path d="M70 70l7-7 6 5 8-9" /> : app === 'doc' ? <path d="M70 72l14-14 4 4-14 14h-4z" /> : <><circle cx="78" cy="65" r="6" /><path d="M83 70l5 5" /></>;
  return (
    <svg className="addin-welcome-art" viewBox="0 0 104 92" aria-hidden="true">
      {page}
      <circle cx="79" cy="67" r="20" className="addin-welcome-badge" />
      {badge}
    </svg>
  );
}

function AddinWelcome({ provider, app, onLogin, onUseKey }: { provider: AddinProvider; app: AddinApp; onLogin: () => void; onUseKey: () => void }) {
  const info = ADDIN_INFO[provider];
  const copy = WELCOME[app];
  return (
    <div className="addin-welcome">
      <WelcomeArt app={app} />
      <h2>{info.name}, ngay trong {copy.place} của bạn</h2>
      <p>{copy.text}</p>
      <div className="addin-welcome-actions">
        <button type="button" className="addin-welcome-primary" onClick={onLogin}><LogIn size={16} /><span>Đăng nhập</span></button>
        <button type="button" className="addin-welcome-secondary" onClick={onUseKey}><KeyRound size={16} /><span>Dùng API key riêng</span></button>
      </div>
      <small>Đăng nhập bằng tài khoản Google để dùng lượt miễn phí mỗi ngày của Minh Spark Office.</small>
    </div>
  );
}

function MessageView({ message, actions }: { message: Message; actions: AddinAction[] }) {
  const [notice, setNotice] = useState('');
  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 1800);
  };

  if (message.role === 'user') return <div className="addin-msg addin-msg-user">{message.content}</div>;

  const done = !message.streaming && Boolean(message.content);
  return (
    <div className="addin-msg addin-msg-ai">
      {message.content ? <div className="addin-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} /> : message.streaming && <div className="addin-typing" aria-label="Đang trả lời"><i /><i /><i /></div>}
      {message.error && <div className="addin-error" role="alert">{message.error}</div>}
      {done && (
        <div className="addin-msg-actions">
          <button type="button" className="addin-act" onClick={() => { void navigator.clipboard?.writeText(message.content).then(() => flash('Đã chép')); }}><Copy size={13} /><span>Chép</span></button>
          {actions.filter((action) => action.isAvailable?.(message.content) ?? true).map((action) => (
            <button type="button" key={action.id} className="addin-act" onClick={() => flash(action.run(message.content) || 'Xong')}>{action.icon}<span>{action.label}</span></button>
          ))}
          {notice && <span className="addin-notice"><Check size={12} />{notice}</span>}
        </div>
      )}
    </div>
  );
}

function AddinSettings({ provider, signedIn, onLogin, onSaved, onDone }: { provider: AddinProvider; signedIn: boolean; onLogin: () => Promise<unknown> | void; onSaved: () => void; onDone: () => void }) {
  const info = ADDIN_INFO[provider];
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const hasKey = Boolean(getProviderKey(provider));

  const save = (next: string) => {
    try {
      setProviderKey(provider, next);
      onSaved();
      setValue('');
      setMessage(next.trim() ? 'Đã lưu API key trên máy này.' : 'Đã xoá API key.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không lưu được.');
    }
  };

  return (
    <div className="addin-settings">
      <section>
        <h4>Tài khoản Google</h4>
        <p>{signedIn ? `Đã đăng nhập. ${info.name} dùng lượt miễn phí mỗi ngày của Minh Spark Office khi chưa có API key riêng.` : 'Đăng nhập để dùng lượt miễn phí mỗi ngày, không cần API key.'}</p>
        {!signedIn && <button type="button" className="btn" onClick={() => void onLogin()}><LogIn size={14} /><span>Đăng nhập Google</span></button>}
      </section>
      <section>
        <h4>{info.keyLabel}</h4>
        <p>Key riêng được lưu trên máy này và gửi thẳng tới {info.name}, không qua máy chủ Minh Spark Office. Có key thì add-in dùng key, không giới hạn lượt và gửi được tệp lớn.{provider === 'claude' ? ' Key này dùng chung với Minh AI.' : ''}</p>
        <form onSubmit={(event) => { event.preventDefault(); save(value); }}>
          <input className="text-field" type="password" autoComplete="off" spellCheck={false} placeholder={hasKey ? 'Đã có key. Nhập key mới để thay' : info.keyHint} value={value} onChange={(event) => setValue(event.target.value)} />
          <div className="addin-settings-row">
            <button type="submit" className="btn btn-primary" disabled={!value.trim()}>Lưu key</button>
            {hasKey && <button type="button" className="btn" onClick={() => save('')}>Xoá key</button>}
            <a href={info.keyUrl} target="_blank" rel="noreferrer">Lấy API key</a>
          </div>
        </form>
        {message && <p className="addin-settings-msg">{message}</p>}
      </section>
      <button type="button" className="btn" onClick={onDone}>Quay lại trò chuyện</button>
    </div>
  );
}

export function useAnyAddinEnabled() {
  const settings = useSettings();
  return settings.addinClaude || settings.addinChatgpt;
}

export function AddinRibbonButtons({ className, labelClass }: { className: string; labelClass?: string }) {
  const open = useOpenAddin();
  const settings = useSettings();
  return (
    <>
      {(Object.keys(ADDIN_INFO) as AddinProvider[]).filter((provider) => addinEnabled(provider, settings)).map((provider) => (
        <button
          key={provider}
          type="button"
          className={`${className} ${open === provider ? 'active' : ''}`}
          title={`Mở add-in ${ADDIN_INFO[provider].name}`}
          aria-pressed={open === provider}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => toggleAddin(provider)}
        >
          <img src={ADDIN_INFO[provider].logo} alt="" width={22} height={22} />
          <span className={labelClass}>{ADDIN_INFO[provider].name}</span>
        </button>
      ))}
    </>
  );
}
