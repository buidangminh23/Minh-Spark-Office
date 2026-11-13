import { getSettings } from '../../../lib/appSettings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { generateHTML } from '@tiptap/core';
import { Circle, CirclePlay, Command, Glasses, Pause, Play, Search, Square, Trash2, Wand2, X, ZoomIn, Columns3 } from 'lucide-react';
import { newId, useDoc, type DialogId, type DocCtx } from '../DocContext';
import type { FileMeta, FileContent } from '../../../lib/storage';
import { downloadBlob, pickFile } from '../../../lib/download';
import { useFormatState } from '../useFormatState';
import { useWordShortcuts } from '../viewShortcuts';
import { appendSteps, describeStep, loadMacros, runSteps, saveMacros, stepsFromTransaction, type Macro, type MacroStep } from '../viewMacros';
import { AUTOCORRECT_KEY, loadAutoCorrect, type AutoCorrectEntry } from '../extView';
import Modal from './Modal';
import HomeTab from './tabs/HomeTab';
import InsertTab from './tabs/InsertTab';
import DrawTab from './tabs/DrawTab';
import { DesignTab, LayoutTab } from './tabs/LayoutTabs';
import { ReferencesTab, ReviewTab } from './tabs/ReviewTabs';
import MailingsTab from './tabs/MailingsTab';
import { HelpTab, ViewTab } from './tabs/ViewTabs';
import { useDocFeatures } from './tabs/useDocFeatures';
import { pageDimensions } from './Paper';
import { disposeMirrors } from '../viewMirror';

function ZoomDialog({ onClose }: { onClose: () => void }) {
  const { view, setView, page } = useDoc();
  const dims = pageDimensions(page.size, page.orientation);
  const [percent, setPercent] = useState(view.zoom);
  const canvas = document.querySelector('.doc-canvas');
  const width = (canvas?.clientWidth ?? window.innerWidth) - 64;
  const height = (canvas?.clientHeight ?? window.innerHeight) - 80;
  const clamp = (value: number) => Math.max(10, Math.min(500, Math.round(value)));
  const textWidth = dims.width - page.margins.left - page.margins.right;
  const [pagesAcross, setPagesAcross] = useState(2);
  const presets: { label: string; value: number }[] = [
    { label: '200%', value: 200 }, { label: '100%', value: 100 }, { label: '75%', value: 75 },
    { label: 'Chiều rộng trang', value: clamp((width / dims.width) * 100) },
    { label: 'Chiều rộng chữ', value: clamp((width / textWidth) * 100) },
    { label: 'Cả trang', value: clamp((height / dims.height) * 100) },
  ];
  const apply = () => {
    setView({ zoom: clamp(percent), ...(pagesAcross > 1 && percent === clamp((width / (dims.width * pagesAcross + 24 * (pagesAcross - 1))) * 100) ? { pageMove: 'side' as const, viewMode: 'print' as const } : {}) });
    onClose();
  };
  return (
    <Modal title="Thu phóng" icon={<ZoomIn size={20} />} onClose={onClose} width={480} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Đồng ý</button></>}>
      <div className="zoom-presets">
        {presets.map((item) => (
          <label key={item.label} className="zoom-preset"><input type="radio" name="zoom-preset" checked={percent === item.value} onChange={() => setPercent(item.value)} /> {item.label}</label>
        ))}
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Phần trăm</span><input className="text-field" type="number" min={10} max={500} value={percent} onChange={(event) => setPercent(Number(event.target.value) || 100)} /></label>
        <label className="field"><span className="field-label">Nhiều trang cạnh nhau</span>
          <select className="text-field" value={pagesAcross} onChange={(event) => { const count = Number(event.target.value); setPagesAcross(count); setPercent(clamp((width / (dims.width * count + 24 * (count - 1))) * 100)); }}>
            {[2, 3, 4].map((count) => <option key={count} value={count}>{count} trang</option>)}
          </select>
        </label>
      </div>
      <div className="zoom-sample" style={{ fontSize: `${(12 * percent) / 100}pt` }}>Aa Bb Cc Tiếng Việt</div>
    </Modal>
  );
}

const newMacroName = () => `Macro ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

function MacrosDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [list, setList] = useState<Macro[]>(loadMacros);
  const [selected, setSelected] = useState(list[0]?.id ?? '');
  const macro = list.find((item) => item.id === selected);
  const update = (next: Macro[]) => { setList(next); saveMacros(next); };
  const rename = (name: string) => update(list.map((item) => (item.id === selected ? { ...item, name } : item)));
  const remove = () => { update(list.filter((item) => item.id !== selected)); setSelected(''); };
  const importFile = async () => {
    const file = await pickFile('.json');
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Macro[];
      if (!Array.isArray(parsed)) throw new Error('bad');
      update([...list, ...parsed.map((item) => ({ ...item, id: newId('m') }))]);
    } catch {
      ctx.ui.toast('Tệp macro không đúng định dạng', true);
    }
  };
  return (
    <Modal title="Macro" subtitle="Ghi lại thao tác gõ, định dạng và đổi kiểu đoạn rồi chạy lại ở vị trí con trỏ." icon={<CirclePlay size={20} />} onClose={onClose} width={640} actions={<>
      <button className="btn" onClick={() => void importFile()}>Nhập tệp</button>
      <button className="btn" disabled={!list.length} onClick={() => downloadBlob(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' }), 'macro-minh-docs.json')}>Xuất tệp</button>
      <span className="spacer" />
      <button className="btn" onClick={() => { onClose(); ctx.setView({ recording: !ctx.view.recording }); }}>{ctx.view.recording ? <><Square size={13} /> Dừng ghi</> : <><Circle size={13} /> Ghi macro mới</>}</button>
      <button className="btn btn-primary" disabled={!macro} onClick={() => { if (!macro) return; if (getSettings().macroPolicy === 'disable') { ctx.ui.toast('Macro đang bị tắt trong Cài đặt → Bảo mật & Quyền riêng tư.', true); return; } onClose(); runSteps(ctx.editor, macro.steps); ctx.ui.toast(`Đã chạy “${macro.name}”`); }}><Play size={13} /> Chạy</button>
    </>}>
      {!list.length ? <div className="panel-empty">Chưa có macro nào. Bấm Ghi macro mới, thao tác trong tài liệu rồi bấm Dừng ghi ở thanh trạng thái.</div> : (
        <div className="macro-grid">
          <div className="macro-list" role="listbox" aria-label="Danh sách macro">
            {list.map((item) => <button key={item.id} type="button" role="option" aria-selected={item.id === selected} className={item.id === selected ? 'on' : ''} onClick={() => setSelected(item.id)}>{item.name}<small>{item.steps.length} bước</small></button>)}
          </div>
          {macro && (
            <div className="macro-detail">
              <label className="field"><span className="field-label">Tên macro</span><input className="text-field" value={macro.name} onChange={(event) => rename(event.target.value)} /></label>
              <ol className="macro-steps">{macro.steps.map((step, index) => <li key={index}>{describeStep(step)}</li>)}</ol>
              <button className="btn" onClick={remove}><Trash2 size={13} /> Xoá macro</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function SideBySideDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [files, setFiles] = useState<FileMeta[] | null>(null);
  useEffect(() => {
    void ctx.storage.listFiles().then((list) => setFiles(list.filter((file) => file.kind === 'doc' && !file.deletedAt && file.id !== ctx.meta.id)));
  }, [ctx.storage, ctx.meta.id]);
  return (
    <Modal title="Xem song song" subtitle="Chọn tài liệu để đặt cạnh tài liệu này." icon={<Columns3 size={20} />} onClose={onClose} width={520}>
      {files === null ? <div className="panel-empty">Đang tải danh sách…</div> : files.length === 0 ? <div className="panel-empty">Chưa có tài liệu nào khác trong danh sách tệp.</div> : (
        <div className="file-pick-list">
          {files.map((file) => <button key={file.id} type="button" className="ribbon-menu-item" onClick={() => { ctx.setView({ sideBySide: file.id, syncScroll: true }); onClose(); }}>{file.name}</button>)}
        </div>
      )}
    </Modal>
  );
}

function AutoCorrectDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [entries, setEntries] = useState<AutoCorrectEntry[]>(loadAutoCorrect);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const save = (next: AutoCorrectEntry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(AUTOCORRECT_KEY, JSON.stringify(next));
    } catch {
      ctx.ui.toast('Không lưu được danh sách tự sửa', true);
    }
    const storage = ctx.editor.storage as unknown as { userAutoCorrect?: { entries: AutoCorrectEntry[] } };
    if (storage.userAutoCorrect) storage.userAutoCorrect.entries = next;
  };
  const add = () => {
    if (!from.trim() || !to.trim()) return;
    save([...entries.filter((item) => item.from !== from.trim()), { from: from.trim(), to: to.trim() }]);
    setFrom('');
    setTo('');
  };
  return (
    <Modal title="Tuỳ chọn tự sửa" subtitle="Gõ cụm bên trái rồi nhấn phím cách, 23 Docs đổi sang cụm bên phải." icon={<Wand2 size={20} />} onClose={onClose} width={560}>
      <div className="check-row"><label><input type="checkbox" checked={ctx.page.autocorrect !== false} onChange={(event) => ctx.setPage({ autocorrect: event.target.checked })} /> Bật tự sửa và tự viết hoa đầu câu</label></div>
      <div className="autocorrect-add">
        <input className="text-field" placeholder="Gõ tắt, ví dụ ctcp" aria-label="Cụm gõ tắt" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="text-field" placeholder="Đổi thành, ví dụ Công ty cổ phần" aria-label="Đổi thành" value={to} onChange={(event) => setTo(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} />
        <button className="btn btn-primary" onClick={add}>Thêm</button>
      </div>
      <div className="autocorrect-list">
        {entries.length === 0 && <div className="panel-empty">Chưa có cụm nào.</div>}
        {entries.map((item) => (
          <div key={item.from} className="autocorrect-row"><code>{item.from}</code><span>{item.to}</span><button className="icon-btn" aria-label={`Xoá ${item.from}`} onClick={() => save(entries.filter((entry) => entry.from !== item.from))}><X size={13} /></button></div>
        ))}
      </div>
    </Modal>
  );
}

const IMMERSIVE_KEY = 'minh-docs-immersive';
type ImmersiveSettings = { size: number; spacing: number; width: number; theme: 'light' | 'sepia' | 'dark'; font: string; focusLines: number };
const IMMERSIVE_FONTS = ['Times New Roman', 'Cambria', 'Arial', 'Segoe UI', 'Tahoma'];
const IMMERSIVE_DEFAULT: ImmersiveSettings = { size: 20, spacing: 0, width: 720, theme: 'sepia', font: 'Times New Roman', focusLines: 0 };

function ImmersiveReader({ onClose }: { onClose: () => void }) {
  const { editor, title, ui } = useDoc();
  const [settings, setSettings] = useState<ImmersiveSettings>(() => {
    try {
      const saved = { ...IMMERSIVE_DEFAULT, ...(JSON.parse(localStorage.getItem(IMMERSIVE_KEY) ?? '{}') as Partial<ImmersiveSettings>) };
      return IMMERSIVE_FONTS.includes(saved.font) ? saved : { ...saved, font: IMMERSIVE_DEFAULT.font };
    } catch {
      return IMMERSIVE_DEFAULT;
    }
  });
  const [speaking, setSpeaking] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [rate, setRate] = useState(1);
  const [pointerY, setPointerY] = useState(window.innerHeight / 2);
  const body = useRef<HTMLDivElement | null>(null);
  const html = useMemo(() => {
    const clone = editor.view.dom.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.page-spacer, .page-spacer-row, .ProseMirror-widget, img, [data-page-break]').forEach((el) => el.remove());
    clone.removeAttribute('contenteditable');
    return clone.innerHTML;
  }, [editor]);
  const put = (patch: Partial<ImmersiveSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      localStorage.setItem(IMMERSIVE_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  };
  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking('idle');
    body.current?.querySelectorAll('.immersive-reading').forEach((el) => el.classList.remove('immersive-reading'));
  };
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const play = () => {
    if (!('speechSynthesis' in window)) return ui.toast('Trình duyệt không hỗ trợ đọc to', true);
    if (speaking === 'paused') { window.speechSynthesis.resume(); setSpeaking('playing'); return; }
    if (speaking === 'playing') { window.speechSynthesis.pause(); setSpeaking('paused'); return; }
    const blocks = [...(body.current?.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th') ?? [])].filter((el) => el.textContent?.trim() && !el.querySelector('p, li'));
    if (!blocks.length) return ui.toast('Không có nội dung để đọc', true);
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('vi')) ?? null;
    window.speechSynthesis.cancel();
    blocks.forEach((block, index) => {
      const utter = new SpeechSynthesisUtterance(block.textContent ?? '');
      utter.lang = 'vi-VN';
      utter.rate = rate;
      if (voice) utter.voice = voice;
      utter.onstart = () => {
        body.current?.querySelectorAll('.immersive-reading').forEach((el) => el.classList.remove('immersive-reading'));
        block.classList.add('immersive-reading');
        block.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
      if (index === blocks.length - 1) utter.onend = stop;
      window.speechSynthesis.speak(utter);
    });
    setSpeaking('playing');
  };
  const band = settings.focusLines * settings.size * 1.9;
  return (
    <div className={`immersive-reader theme-${settings.theme}`} role="dialog" aria-modal="true" aria-label="Trình đọc chân thực" onMouseMove={(event) => setPointerY(event.clientY)}>
      <header className="immersive-bar">
        <Glasses size={16} />
        <strong>{title}</strong>
        <span className="spacer" />
        <label>Cỡ chữ <input type="range" min={14} max={40} value={settings.size} onChange={(event) => put({ size: Number(event.target.value) })} /></label>
        <label>Giãn chữ <input type="range" min={0} max={6} step={0.5} value={settings.spacing} onChange={(event) => put({ spacing: Number(event.target.value) })} /></label>
        <label>Độ rộng cột
          <select value={settings.width} onChange={(event) => put({ width: Number(event.target.value) })}>
            <option value={520}>Hẹp</option><option value={720}>Vừa</option><option value={960}>Rộng</option>
          </select>
        </label>
        <label>Phông
          <select value={settings.font} onChange={(event) => put({ font: event.target.value })}>
            {IMMERSIVE_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </label>
        <label>Nền
          <select value={settings.theme} onChange={(event) => put({ theme: event.target.value as ImmersiveSettings['theme'] })}>
            <option value="light">Trắng</option><option value="sepia">Giấy cũ</option><option value="dark">Tối</option>
          </select>
        </label>
        <label>Tiêu điểm dòng
          <select value={settings.focusLines} onChange={(event) => put({ focusLines: Number(event.target.value) })}>
            <option value={0}>Tắt</option><option value={1}>1 dòng</option><option value={3}>3 dòng</option><option value={5}>5 dòng</option>
          </select>
        </label>
        <label>Tốc độ
          <select value={rate} onChange={(event) => setRate(Number(event.target.value))}>
            {[0.75, 1, 1.25, 1.5].map((value) => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
        <button className="btn" onClick={play}>{speaking === 'playing' ? <><Pause size={13} /> Tạm dừng</> : <><Play size={13} /> Đọc to</>}</button>
        {speaking !== 'idle' && <button className="btn" onClick={stop}><Square size={13} /> Dừng</button>}
        <button className="btn" onClick={onClose}><X size={13} /> Thoát (Esc)</button>
      </header>
      <div className="immersive-scroll">
        <div ref={body} className="immersive-body tiptap" style={{ maxWidth: settings.width, fontSize: settings.size, letterSpacing: settings.spacing, wordSpacing: settings.spacing * 2, fontFamily: `"${settings.font}", serif` }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {settings.focusLines > 0 && (
        <>
          <div className="immersive-mask" style={{ top: 0, height: Math.max(0, pointerY - band / 2) }} />
          <div className="immersive-mask" style={{ top: pointerY + band / 2, bottom: 0 }} />
        </>
      )}
    </div>
  );
}

type PaletteItem = { id: string; label: string; tab?: string; tabLabel: string; run?: () => void };

const TAB_LABELS: Record<string, string> = { home: 'Trang chủ', insert: 'Chèn', draw: 'Vẽ', design: 'Thiết kế', layout: 'Bố cục', references: 'Tham chiếu', mailings: 'Gửi thư', review: 'Xem lại', view: 'Xem', help: 'Trợ giúp' };
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

function CommandPalette({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const fmt = useFormatState(ctx.editor);
  const dims = pageDimensions(ctx.page.size, ctx.page.orientation);
  const hidden = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [commands, setCommands] = useState<PaletteItem[]>([]);
  const features = useDocFeatures();
  useEffect(() => {
    const found: PaletteItem[] = [];
    hidden.current?.querySelectorAll<HTMLElement>('[data-palette-tab]').forEach((section) => {
      const tab = section.dataset.paletteTab ?? '';
      section.querySelectorAll<HTMLButtonElement>('button[title]').forEach((button) => {
        if (found.some((item) => item.tab === tab && item.label === button.title)) return;
        found.push({ id: `${tab}:${button.title}`, label: button.title, tab, tabLabel: TAB_LABELS[tab] ?? tab });
      });
    });
    const dialogs: [string, DialogId][] = [['Hộp thoại Phông chữ', 'font'], ['Hộp thoại Đoạn văn', 'paragraph'], ['Thiết lập trang', 'pagesetup'], ['Danh sách phím tắt', 'shortcuts'], ['Macro', 'macros'], ['Tuỳ chọn tự sửa', 'autocorrect'], ['Trình đọc chân thực', 'immersive'], ['Thu phóng', 'zoom'], ['Tệp và xuất', 'backstage']];
    dialogs.forEach(([label, id]) => found.push({ id: `dialog:${id}`, label, tabLabel: 'Hộp thoại', run: () => ctx.openDialog(id) }));
    features.forEach((feature) => found.push({ id: `feature:${feature.id}`, label: feature.label, tabLabel: 'Tính năng', run: feature.run }));
    setCommands(found);
  }, [ctx, features]);
  const results = useMemo(() => {
    const term = fold(query.trim());
    return (term ? commands.filter((item) => fold(`${item.label} ${item.tabLabel}`).includes(term)) : commands).slice(0, 40);
  }, [commands, query]);
  useEffect(() => setIndex(0), [query]);
  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    if (item.run) return item.run();
    ctx.setView({ ribbonCollapsed: false });
    ctx.setTab(item.tab ?? 'home');
    window.setTimeout(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('.ribbon-body button[title]')].find((el) => el.title === item.label);
      button?.click();
      button?.focus();
    }, 60);
  };
  return (
    <div className="dialog-backdrop palette-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Tìm lệnh">
        <div className="palette-input">
          <Search size={16} />
          <input autoFocus placeholder="Tìm lệnh, ví dụ: chia cột, hình mờ, mục lục" aria-label="Tìm lệnh" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((value) => Math.min(results.length - 1, value + 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
            if (event.key === 'Enter') choose(results[index]);
            if (event.key === 'Escape') onClose();
          }} />
          <kbd>Alt+Q</kbd>
        </div>
        <div className="palette-list" role="listbox">
          {results.length === 0 && <div className="panel-empty">Không tìm thấy lệnh phù hợp.</div>}
          {results.map((item, i) => (
            <button key={item.id} type="button" role="option" aria-selected={i === index} className={i === index ? 'on' : ''} onMouseEnter={() => setIndex(i)} onClick={() => choose(item)}>
              <Command size={13} /><span>{item.label}</span><small>{item.tabLabel}</small>
            </button>
          ))}
        </div>
      </section>
      <div ref={hidden} className="palette-hidden" aria-hidden>
        <div data-palette-tab="home"><HomeTab fmt={fmt} /></div>
        <div data-palette-tab="insert"><InsertTab /></div>
        <div data-palette-tab="draw"><DrawTab /></div>
        <div data-palette-tab="design"><DesignTab /></div>
        <div data-palette-tab="layout"><LayoutTab fmt={fmt} /></div>
        <div data-palette-tab="references"><ReferencesTab /></div>
        <div data-palette-tab="mailings"><MailingsTab /></div>
        <div data-palette-tab="review"><ReviewTab /></div>
        <div data-palette-tab="view"><ViewTab pageWidth={dims.width} pageHeight={dims.height} /></div>
        <div data-palette-tab="help"><HelpTab /></div>
      </div>
    </div>
  );
}

export default function ViewExtras({ dialog, onClose }: { dialog: DialogId | null; onClose: () => void }) {
  return (
    <>
      {dialog === 'zoom' && <ZoomDialog onClose={onClose} />}
      {dialog === 'macros' && <MacrosDialog onClose={onClose} />}
      {dialog === 'sidebyside' && <SideBySideDialog onClose={onClose} />}
      {dialog === 'autocorrect' && <AutoCorrectDialog onClose={onClose} />}
      {dialog === 'immersive' && <ImmersiveReader onClose={onClose} />}
      {dialog === 'commandpalette' && <CommandPalette onClose={onClose} />}
    </>
  );
}

export function SplitPane() {
  const { editor, view, setView } = useDoc();
  const host = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(45);
  const refresh = useRef<() => void>(() => undefined);
  refresh.current = () => {
    const target = host.current;
    if (!target) return;
    const clone = editor.view.dom.cloneNode(true) as HTMLElement;
    clone.removeAttribute('contenteditable');
    target.replaceChildren(clone);
  };
  useEffect(() => {
    if (!view.splitView) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh.current(), 200);
    };
    refresh.current();
    editor.on('update', schedule);
    return () => {
      if (timer) clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [editor, view.splitView]);
  if (!view.splitView) return null;
  const jump = (event: React.MouseEvent) => {
    const root = host.current?.firstElementChild;
    let target = event.target as HTMLElement | null;
    while (target && target.parentElement !== root) target = target.parentElement;
    if (!target || !root) return;
    const block = editor.view.dom.children[[...root.children].indexOf(target)];
    if (!block) return;
    block.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const pos = editor.view.posAtDOM(block, 0);
    editor.chain().focus().setTextSelection(pos).run();
  };
  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    const center = (event.currentTarget as HTMLElement).closest('.doc-center');
    if (!center) return;
    const rect = center.getBoundingClientRect();
    const move = (e: PointerEvent) => setHeight(Math.max(15, Math.min(80, ((rect.bottom - e.clientY) / rect.height) * 100)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="split-pane" style={{ height: `${height}%` }}>
      <div className="split-handle" role="separator" aria-label="Kéo để đổi chiều cao" onPointerDown={startDrag}>
        <span>Phần xem thứ hai, nhấp vào đoạn nào để đưa con trỏ tới đó</span>
        <button className="icon-btn" aria-label="Bỏ chia đôi" onClick={() => setView({ splitView: false })}><X size={13} /></button>
      </div>
      <div className="split-scroll"><div className="doc-paper split-paper" ref={host} onClick={jump} /></div>
    </div>
  );
}

function SideBySidePane() {
  const ctx = useDoc();
  const { view, setView, storage, editor } = ctx;
  const scroller = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<{ name: string; html: string } | null>(null);
  useEffect(() => {
    if (!view.sideBySide) return setState(null);
    let alive = true;
    void Promise.all([storage.listFiles(), storage.loadContent(view.sideBySide)]).then(([files, content]: [FileMeta[], FileContent | undefined]) => {
      if (!alive || !content || content.kind !== 'doc') return;
      setState({ name: files.find((file) => file.id === view.sideBySide)?.name ?? 'Tài liệu', html: generateHTML(content.json as Parameters<typeof generateHTML>[0], editor.extensionManager.extensions) });
    }).catch(() => ctx.ui.toast('Không mở được tài liệu để xem song song', true));
    return () => { alive = false; };
  }, [view.sideBySide, storage, editor, ctx.ui]);
  useEffect(() => {
    if (!view.sideBySide || !view.syncScroll) return;
    const main = document.querySelector<HTMLElement>('.doc-canvas');
    const pane = scroller.current;
    if (!main || !pane) return;
    let guard = false;
    const follow = (source: HTMLElement, target: HTMLElement) => () => {
      if (guard) return;
      guard = true;
      const ratio = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight);
      target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
      requestAnimationFrame(() => { guard = false; });
    };
    const onMain = follow(main, pane);
    const onPane = follow(pane, main);
    main.addEventListener('scroll', onMain);
    pane.addEventListener('scroll', onPane);
    return () => {
      main.removeEventListener('scroll', onMain);
      pane.removeEventListener('scroll', onPane);
    };
  }, [view.sideBySide, view.syncScroll, state]);
  if (!view.sideBySide) return null;
  return (
    <aside className="side-pane" aria-label="Tài liệu xem song song">
      <div className="panel-head"><span>{state?.name ?? 'Đang tải…'}</span><button className="icon-btn" aria-label="Đóng xem song song" onClick={() => setView({ sideBySide: null })}><X size={14} /></button></div>
      <div className="side-pane-scroll" ref={scroller}>
        {state && <div className="doc-paper side-paper"><div className="tiptap" dangerouslySetInnerHTML={{ __html: state.html }} /></div>}
      </div>
    </aside>
  );
}

function MacroRecorder() {
  const ctx = useDoc();
  const { editor, view, setView, ui } = ctx;
  const steps = useRef<MacroStep[]>([]);
  useEffect(() => {
    if (!view.recording) return;
    steps.current = [];
    const listen = ({ transaction }: { transaction: import('@tiptap/pm/state').Transaction }) => {
      if (transaction.docChanged) appendSteps(steps.current, stepsFromTransaction(transaction));
    };
    editor.on('transaction', listen);
    ui.toast('Đang ghi macro. Thao tác trong tài liệu, xong bấm Dừng ghi ở thanh trạng thái.');
    return () => {
      editor.off('transaction', listen);
      const recorded = steps.current;
      if (!recorded.length) return;
      void ui.ask({ title: 'Lưu macro', message: `Đã ghi ${recorded.length} bước.`, fields: [{ name: 'name', label: 'Tên macro', value: newMacroName() }], confirmText: 'Lưu' }).then((res) => {
        if (!res) return;
        saveMacros([...loadMacros(), { id: newId('m'), name: String(res.name).trim() || newMacroName(), steps: recorded, createdAt: Date.now() }]);
        ui.toast('Đã lưu macro');
      });
    };
  }, [editor, view.recording, ui]);
  void setView;
  return null;
}

export function ViewPanels() {
  const ctx = useDoc();
  const ctxRef = useRef<DocCtx | null>(ctx);
  ctxRef.current = ctx;
  useWordShortcuts(ctxRef);
  const { editor, view } = ctx;
  useEffect(() => {
    editor.commands.setOutlineView(view.viewMode === 'outline', view.outlineLevel);
  }, [editor, view.viewMode, view.outlineLevel]);
  useEffect(() => () => {
    disposeMirrors();
  }, []);
  return (
    <>
      <MacroRecorder />
      <SideBySidePane />
    </>
  );
}
