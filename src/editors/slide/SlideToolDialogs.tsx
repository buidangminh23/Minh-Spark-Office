import { useEffect, useRef, useState } from 'react';
import { Circle, Pause, Play, Square, Trash2 } from 'lucide-react';
import type { MacroStep, PresentationData, ShowSettings, SlideAspect, SlideElement, SlideMacro } from '../../lib/slideTypes';
import { SLIDE_ASPECTS, slideAspectInfo } from '../../lib/settings/slideOptions';
import { compressImage } from '../../lib/slideImageOps';
import { askSlideAi, parseJsonBlock, TRANSLATE_LANGUAGES } from '../../lib/slideAi';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { TRANSITION_DEFS } from '../../lib/slideEffects';
import { formatBytes, readAsDataUrl } from '../../lib/download';
import { formatDuration, pickRecordingMime } from '../../lib/slideRecorder';
import { Dialog, DialogButtons, Field } from './ribbonParts';
import { newElementId, useSlideExtras } from './slideExtrasContext';

type CloseProps = { onClose: () => void };

export function SlideSizeDialog({ onClose, onApply }: CloseProps & { onApply: (aspect: SlideAspect) => void }) {
  const x = useSlideExtras();
  const [aspect, setAspect] = useState<SlideAspect>(x.presentation.aspectRatio);
  const info = slideAspectInfo(aspect);
  return (
    <Dialog title="Kích cỡ trang chiếu" onClose={onClose} width={440} footer={<DialogButtons onCancel={onClose} onOk={() => { onApply(aspect); onClose(); }} />}>
      <Field label="Kích cỡ trang chiếu cho">
        <select className="ppt-select" value={aspect} onChange={(e) => setAspect(e.target.value as SlideAspect)}>
          {SLIDE_ASPECTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </Field>
      <div className="ppx-grid-2">
        <Field label="Rộng"><input className="ppt-input" readOnly value={`${(info.widthIn * 2.54).toFixed(2).replace('.', ',')} cm`} /></Field>
        <Field label="Cao"><input className="ppt-input" readOnly value={`${(info.heightIn * 2.54).toFixed(2).replace('.', ',')} cm`} /></Field>
      </div>
      <div className="ppx-muted">Nội dung được co giãn theo tỷ lệ, không bị cắt.</div>
    </Dialog>
  );
}

export function SetupShowDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [s, setS] = useState<ShowSettings>(() => ({ showType: 'speaker', loop: false, advance: 'timings', penColor: '#EF4444', laserColor: '#FF0033', ...x.presentation.showSettings }));
  const slideCount = x.presentation.slides.length;
  const customShows = x.presentation.customShows ?? [];
  const range: 'all' | 'range' | 'custom' = s.customShowId ? 'custom' : s.rangeFrom ? 'range' : 'all';
  return (
    <Dialog title="Thiết lập trình chiếu" onClose={onClose} width={600} footer={<DialogButtons onCancel={onClose} onOk={() => { x.commit((p) => ({ ...p, showSettings: s })); onClose(); }} />}>
      <div className="ppx-grid-2">
        <fieldset className="ppx-fieldset">
          <legend>Kiểu trình chiếu</legend>
          <label className="ppt-checkbox-label"><input type="radio" checked={s.showType === 'speaker'} onChange={() => setS({ ...s, showType: 'speaker' })} /> Do người thuyết trình điều khiển (toàn màn hình)</label>
          <label className="ppt-checkbox-label"><input type="radio" checked={s.showType === 'window'} onChange={() => setS({ ...s, showType: 'window' })} /> Người xem tự duyệt (trong cửa sổ)</label>
          <label className="ppt-checkbox-label"><input type="radio" checked={s.showType === 'kiosk'} onChange={() => setS({ ...s, showType: 'kiosk', loop: true, advance: 'timings' })} /> Tự chạy ở ki-ốt (toàn màn hình)</label>
        </fieldset>
        <fieldset className="ppx-fieldset">
          <legend>Trang chiếu</legend>
          <label className="ppt-checkbox-label"><input type="radio" checked={range === 'all'} onChange={() => setS({ ...s, rangeFrom: undefined, rangeTo: undefined, customShowId: undefined })} /> Tất cả</label>
          <label className="ppt-checkbox-label">
            <input type="radio" checked={range === 'range'} onChange={() => setS({ ...s, rangeFrom: 1, rangeTo: slideCount, customShowId: undefined })} /> Từ
            <input className="ppt-input ppx-num" type="number" min={1} max={slideCount} value={s.rangeFrom ?? 1} onChange={(e) => setS({ ...s, rangeFrom: Number(e.target.value), customShowId: undefined })} /> đến
            <input className="ppt-input ppx-num" type="number" min={1} max={slideCount} value={s.rangeTo ?? slideCount} onChange={(e) => setS({ ...s, rangeTo: Number(e.target.value), rangeFrom: s.rangeFrom ?? 1, customShowId: undefined })} />
          </label>
          <label className="ppt-checkbox-label">
            <input type="radio" disabled={customShows.length === 0} checked={range === 'custom'} onChange={() => setS({ ...s, customShowId: customShows[0]?.id, rangeFrom: undefined })} /> Bài chiếu tùy biến
            <select className="ppt-select" disabled={range !== 'custom'} value={s.customShowId ?? ''} onChange={(e) => setS({ ...s, customShowId: e.target.value })}>
              {customShows.map((show) => <option key={show.id} value={show.id}>{show.name}</option>)}
            </select>
          </label>
        </fieldset>
        <fieldset className="ppx-fieldset">
          <legend>Tùy chọn</legend>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={s.loop ?? false} onChange={(e) => setS({ ...s, loop: e.target.checked })} /> Lặp liên tục đến khi bấm Esc</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={s.withoutNarration ?? false} onChange={(e) => setS({ ...s, withoutNarration: e.target.checked })} /> Trình chiếu không có thuyết minh</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={s.withoutAnimation ?? false} onChange={(e) => setS({ ...s, withoutAnimation: e.target.checked })} /> Trình chiếu không có hoạt hình</label>
          <label className="ppx-inline">Màu bút <input type="color" value={s.penColor ?? '#EF4444'} onChange={(e) => setS({ ...s, penColor: e.target.value })} /></label>
          <label className="ppx-inline">Màu con trỏ laser <input type="color" value={s.laserColor ?? '#FF0033'} onChange={(e) => setS({ ...s, laserColor: e.target.value })} /></label>
        </fieldset>
        <fieldset className="ppx-fieldset">
          <legend>Chuyển trang</legend>
          <label className="ppt-checkbox-label"><input type="radio" checked={s.advance === 'manual'} onChange={() => setS({ ...s, advance: 'manual', useTimings: false })} /> Thủ công</label>
          <label className="ppt-checkbox-label"><input type="radio" checked={s.advance !== 'manual'} onChange={() => setS({ ...s, advance: 'timings', useTimings: true })} /> Dùng thời gian, nếu có</label>
          <legend className="ppx-legend-2">Nhiều màn hình</legend>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={s.usePresenterView ?? false} onChange={(e) => setS({ ...s, usePresenterView: e.target.checked })} /> Dùng chế độ Diễn giả</label>
        </fieldset>
      </div>
    </Dialog>
  );
}

export function ExportVideoDialog({ onClose, onStart }: CloseProps & { onStart: (secondsPerSlide: number, useTimings: boolean) => void }) {
  const [seconds, setSeconds] = useState(5);
  const [useTimings, setUseTimings] = useState(true);
  const supported = pickRecordingMime() !== '' && Boolean(navigator.mediaDevices?.getDisplayMedia);
  return (
    <Dialog title="Xuất video" onClose={onClose} width={460} footer={<DialogButtons onCancel={onClose} okLabel="Tạo video" okDisabled={!supported} onOk={() => { onStart(seconds, useTimings); onClose(); }} />}>
      {!supported && <div className="ppx-warn">Trình duyệt này chưa cho phép ghi màn hình. Hãy dùng Chrome hoặc Edge bản mới.</div>}
      <label className="ppt-checkbox-label"><input type="checkbox" checked={useTimings} onChange={(e) => setUseTimings(e.target.checked)} /> Dùng thời gian và lời thuyết minh đã ghi</label>
      <Field label="Số giây cho mỗi trang chưa có thời gian">
        <input className="ppt-input" type="number" min={1} max={120} value={seconds} onChange={(e) => setSeconds(Math.max(1, Number(e.target.value)))} />
      </Field>
      <div className="ppx-muted">Khi bấm Tạo video, chọn thẻ này trong hộp thoại chia sẻ. Bài sẽ tự chạy và tự lưu tệp video khi hết.</div>
    </Dialog>
  );
}

const LANGUAGES: ReadonlyArray<readonly [string, string]> = [
  ['vi', 'Tiếng Việt'],
  ['en-US', 'English (United States)'],
  ['en-GB', 'English (United Kingdom)'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['zh-CN', '中文'],
];

export function LanguageDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [lang, setLang] = useState(x.presentation.language ?? 'vi');
  return (
    <Dialog title="Ngôn ngữ soát lỗi" onClose={onClose} width={380} footer={<DialogButtons onCancel={onClose} onOk={() => { x.commit((p) => ({ ...p, language: lang })); onClose(); }} />}>
      <div className="ppx-list" role="listbox">
        {LANGUAGES.map(([id, label]) => (
          <button type="button" key={id} className={`ppx-list-item ${lang === id ? 'is-active' : ''}`} onClick={() => setLang(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="ppx-muted">Trình kiểm tra chính tả dùng ngôn ngữ này khi bạn sửa chữ trên trang.</div>
    </Dialog>
  );
}

function useAiTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const run = async <T,>(task: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError('');
    try {
      return await task(controller.signal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gọi được AI');
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function ThesaurusDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const initial = (window.getSelection()?.toString() || el?.text?.split(/\s+/)[0] || '').trim();
  const [word, setWord] = useState(initial);
  const [result, setResult] = useState<{ synonyms: string[]; antonyms: string[] } | null>(null);
  const ai = useAiTask();
  const lookup = async () => {
    const text = await ai.run((signal) => askSlideAi(`Give synonyms and antonyms for the word or phrase "${word}" in the same language as the word. Reply ONLY JSON: {"synonyms": [...up to 12], "antonyms": [...up to 6]}`, el?.text ?? word, signal));
    if (text) setResult(parseJsonBlock(text) ?? { synonyms: [], antonyms: [] });
  };
  const replace = (next: string) => {
    if (!el?.text || !word) return;
    x.updateElement(el.id, { text: el.text.split(word).join(next) });
    x.toast(`Đã thay "${word}" bằng "${next}"`);
    setWord(next);
  };
  return (
    <Dialog title="Từ điển đồng nghĩa" onClose={onClose} width={440} footer={<button type="button" className="ppt-primary-action-btn" onClick={onClose}>Đóng</button>}>
      <div className="ppx-inline">
        <input className="ppt-input" value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void lookup()} placeholder="Nhập từ cần tra" autoFocus />
        <button type="button" className="ppt-primary-action-btn" disabled={!word.trim() || ai.busy} onClick={() => void lookup()}>{ai.busy ? 'Đang tra…' : 'Tra'}</button>
      </div>
      {ai.error && <div className="ppx-warn">{ai.error}</div>}
      {result && (
        <>
          <div className="ppx-subhead">Đồng nghĩa (bấm để thay vào ô đang chọn)</div>
          <div className="ppx-chips">{result.synonyms.map((s) => <button type="button" key={s} className="ppx-chip" onClick={() => replace(s)} disabled={!el?.text}>{s}</button>)}</div>
          {result.antonyms.length > 0 && (
            <>
              <div className="ppx-subhead">Trái nghĩa</div>
              <div className="ppx-chips">{result.antonyms.map((s) => <button type="button" key={s} className="ppx-chip" onClick={() => replace(s)} disabled={!el?.text}>{s}</button>)}</div>
            </>
          )}
        </>
      )}
    </Dialog>
  );
}

export function TranslateDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [target, setTarget] = useState(x.presentation.language?.startsWith('vi') ? 'English' : 'Vietnamese');
  const [scope, setScope] = useState<'selection' | 'slide' | 'all'>(x.selectedElement?.text ? 'selection' : 'slide');
  const [done, setDone] = useState('');
  const ai = useAiTask();
  const collect = () => {
    const list: { slideIndex: number; id: string; text: string }[] = [];
    x.presentation.slides.forEach((slide, slideIndex) => {
      if (scope !== 'all' && slideIndex !== x.activeSlideIndex) return;
      slide.elements.forEach((el) => {
        if (!el.text?.trim() || el.field) return;
        if (scope === 'selection' && el.id !== x.selectedElement?.id) return;
        list.push({ slideIndex, id: el.id, text: el.text });
      });
    });
    return list;
  };
  const translate = async () => {
    const items = collect();
    if (items.length === 0) return;
    const payload = items.map((item, i) => ({ i, text: item.text }));
    const text = await ai.run((signal) => askSlideAi(`Translate every "text" into ${target}. Keep line breaks, numbers and proper nouns. Reply ONLY JSON array [{"i": number, "text": string}].`, JSON.stringify(payload), signal));
    const parsed = text ? parseJsonBlock<{ i: number; text: string }[]>(text) : null;
    if (!parsed) return;
    const map = new Map(parsed.map((row) => [items[row.i]?.id, row.text]));
    x.commit((p: PresentationData) => ({ ...p, slides: p.slides.map((s) => ({ ...s, elements: s.elements.map((el) => (map.has(el.id) ? { ...el, text: map.get(el.id) } : el)) })) }));
    setDone(`Đã dịch ${map.size} ô chữ. Bấm Hoàn tác (Ctrl+Z) để trả về bản gốc.`);
  };
  return (
    <Dialog title="Dịch" onClose={onClose} width={440} footer={<DialogButtons onCancel={onClose} okLabel={ai.busy ? 'Đang dịch…' : 'Dịch'} okDisabled={ai.busy} onOk={() => void translate()} />}>
      <Field label="Dịch sang">
        <select className="ppt-select" value={target} onChange={(e) => setTarget(e.target.value)}>
          {TRANSLATE_LANGUAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </Field>
      <Field label="Phạm vi">
        <select className="ppt-select" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
          <option value="selection" disabled={!x.selectedElement?.text}>Ô đang chọn</option>
          <option value="slide">Trang chiếu hiện tại</option>
          <option value="all">Cả bài thuyết trình</option>
        </select>
      </Field>
      {ai.error && <div className="ppx-warn">{ai.error}</div>}
      {done && <div className="ppx-ok">{done}</div>}
    </Dialog>
  );
}

const HANDOUT_LAYOUTS = [1, 2, 3, 4, 6, 9] as const;

export function HandoutMasterDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [m, setM] = useState({ slidesPerPage: 3 as (typeof HANDOUT_LAYOUTS)[number], orientation: 'portrait' as 'portrait' | 'landscape', header: '', footer: '', showDate: true, showPageNumber: true, ...x.presentation.handoutMaster });
  return (
    <Dialog title="Bản cái tài liệu phát tay" onClose={onClose} width={520} footer={<DialogButtons onCancel={onClose} okLabel="Đóng dạng xem cái" onOk={() => { x.commit((p) => ({ ...p, handoutMaster: m })); onClose(); }} />}>
      <div className="ppx-grid-2">
        <Field label="Số trang chiếu mỗi trang">
          <select className="ppt-select" value={m.slidesPerPage} onChange={(e) => setM({ ...m, slidesPerPage: Number(e.target.value) as (typeof HANDOUT_LAYOUTS)[number] })}>
            {HANDOUT_LAYOUTS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Hướng trang">
          <select className="ppt-select" value={m.orientation} onChange={(e) => setM({ ...m, orientation: e.target.value as 'portrait' | 'landscape' })}>
            <option value="portrait">Dọc</option>
            <option value="landscape">Ngang</option>
          </select>
        </Field>
        <Field label="Đầu trang"><input className="ppt-input" value={m.header} onChange={(e) => setM({ ...m, header: e.target.value })} /></Field>
        <Field label="Chân trang"><input className="ppt-input" value={m.footer} onChange={(e) => setM({ ...m, footer: e.target.value })} /></Field>
      </div>
      <div className="ppx-checks-row">
        <label className="ppt-checkbox-label"><input type="checkbox" checked={m.showDate} onChange={(e) => setM({ ...m, showDate: e.target.checked })} /> Ngày</label>
        <label className="ppt-checkbox-label"><input type="checkbox" checked={m.showPageNumber} onChange={(e) => setM({ ...m, showPageNumber: e.target.checked })} /> Số trang</label>
      </div>
      <div className={`ppx-handout-preview is-${m.orientation}`}>
        <div className="ppx-handout-head"><span>{m.header}</span><span>{m.showDate ? new Date().toLocaleDateString('vi-VN') : ''}</span></div>
        <div className={`ppx-handout-grid n-${m.slidesPerPage}`}>{Array.from({ length: m.slidesPerPage }, (_, i) => <i key={i} />)}</div>
        <div className="ppx-handout-head"><span>{m.footer}</span><span>{m.showPageNumber ? '1' : ''}</span></div>
      </div>
      <div className="ppx-muted">Bố cục này được dùng làm mặc định khi in tài liệu phát tay.</div>
    </Dialog>
  );
}

export function NotesMasterDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [m, setM] = useState({ orientation: 'portrait' as 'portrait' | 'landscape', header: '', footer: '', showSlideImage: true, showPageNumber: true, bodyFontSize: 12, ...x.presentation.notesMaster });
  return (
    <Dialog title="Bản cái ghi chú" onClose={onClose} width={460} footer={<DialogButtons onCancel={onClose} okLabel="Đóng dạng xem cái" onOk={() => { x.commit((p) => ({ ...p, notesMaster: m })); onClose(); }} />}>
      <div className="ppx-grid-2">
        <Field label="Hướng trang">
          <select className="ppt-select" value={m.orientation} onChange={(e) => setM({ ...m, orientation: e.target.value as 'portrait' | 'landscape' })}>
            <option value="portrait">Dọc</option>
            <option value="landscape">Ngang</option>
          </select>
        </Field>
        <Field label="Cỡ chữ ghi chú"><input className="ppt-input" type="number" min={8} max={28} value={m.bodyFontSize} onChange={(e) => setM({ ...m, bodyFontSize: Number(e.target.value) })} /></Field>
        <Field label="Đầu trang"><input className="ppt-input" value={m.header} onChange={(e) => setM({ ...m, header: e.target.value })} /></Field>
        <Field label="Chân trang"><input className="ppt-input" value={m.footer} onChange={(e) => setM({ ...m, footer: e.target.value })} /></Field>
      </div>
      <div className="ppx-checks-row">
        <label className="ppt-checkbox-label"><input type="checkbox" checked={m.showSlideImage} onChange={(e) => setM({ ...m, showSlideImage: e.target.checked })} /> Ảnh trang chiếu</label>
        <label className="ppt-checkbox-label"><input type="checkbox" checked={m.showPageNumber} onChange={(e) => setM({ ...m, showPageNumber: e.target.checked })} /> Số trang</label>
      </div>
    </Dialog>
  );
}

const MACRO_OPS: ReadonlyArray<readonly [MacroStep['op'], string]> = [
  ['theme', 'Áp chủ đề'],
  ['font', 'Đổi phông chữ mọi ô'],
  ['font-size', 'Tăng/giảm cỡ chữ mọi ô'],
  ['color', 'Đổi màu chữ mọi ô'],
  ['replace', 'Tìm và thay chữ'],
  ['transition', 'Áp hiệu ứng chuyển trang'],
  ['background', 'Đổi màu nền'],
  ['slide-numbers', 'Bật/tắt số trang'],
  ['align', 'Căn lề chữ'],
];

function defaultStep(op: MacroStep['op']): MacroStep {
  switch (op) {
    case 'theme': return { op, themeId: Object.keys(SLIDE_THEMES)[0] };
    case 'font': return { op, fontFamily: "'Segoe UI', sans-serif" };
    case 'font-size': return { op, delta: 2 };
    case 'color': return { op, color: '#1E293B' };
    case 'replace': return { op, find: '', replace: '' };
    case 'transition': return { op, transition: 'fade' };
    case 'background': return { op, value: '#FFFFFF' };
    case 'slide-numbers': return { op, enabled: true };
    default: return { op: 'align', textAlign: 'left' };
  }
}

export function runMacro(p: PresentationData, macro: SlideMacro): PresentationData {
  return macro.steps.reduce((acc, step) => {
    const mapText = (fn: (el: SlideElement) => SlideElement) => ({ ...acc, slides: acc.slides.map((s) => ({ ...s, elements: s.elements.map((el) => (el.text !== undefined ? fn(el) : el)) })) });
    switch (step.op) {
      case 'theme': return { ...acc, themeId: step.themeId };
      case 'font': return mapText((el) => ({ ...el, fontFamily: step.fontFamily }));
      case 'font-size': return mapText((el) => ({ ...el, fontSize: Math.max(6, (el.fontSize ?? 18) + step.delta) }));
      case 'color': return mapText((el) => ({ ...el, color: step.color }));
      case 'replace': return step.find ? mapText((el) => ({ ...el, text: el.text?.split(step.find).join(step.replace) })) : acc;
      case 'transition': return { ...acc, slides: acc.slides.map((s) => ({ ...s, transition: { ...s.transition, type: step.transition } })) };
      case 'background': return { ...acc, slides: acc.slides.map((s) => ({ ...s, background: { type: 'solid' as const, value: step.value } })) };
      case 'slide-numbers': return { ...acc, headerFooter: { ...(acc.headerFooter ?? {}), showSlideNumber: step.enabled } };
      default: return mapText((el) => ({ ...el, textAlign: step.textAlign }));
    }
  }, p);
}

function StepEditor({ step, onChange }: { step: MacroStep; onChange: (step: MacroStep) => void }) {
  switch (step.op) {
    case 'theme': return <select className="ppt-select" value={step.themeId} onChange={(e) => onChange({ ...step, themeId: e.target.value })}>{Object.values(SLIDE_THEMES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>;
    case 'font': return <input className="ppt-input" value={step.fontFamily} onChange={(e) => onChange({ ...step, fontFamily: e.target.value })} />;
    case 'font-size': return <input className="ppt-input ppx-num" type="number" value={step.delta} onChange={(e) => onChange({ ...step, delta: Number(e.target.value) })} />;
    case 'color': return <input type="color" value={step.color} onChange={(e) => onChange({ ...step, color: e.target.value })} />;
    case 'replace': return <span className="ppx-inline"><input className="ppt-input" placeholder="Tìm" value={step.find} onChange={(e) => onChange({ ...step, find: e.target.value })} /><input className="ppt-input" placeholder="Thay bằng" value={step.replace} onChange={(e) => onChange({ ...step, replace: e.target.value })} /></span>;
    case 'transition': return <select className="ppt-select" value={step.transition} onChange={(e) => onChange({ ...step, transition: e.target.value as typeof step.transition })}>{TRANSITION_DEFS.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>;
    case 'background': return <input type="color" value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value })} />;
    case 'slide-numbers': return <label className="ppt-checkbox-label"><input type="checkbox" checked={step.enabled} onChange={(e) => onChange({ ...step, enabled: e.target.checked })} /> Bật</label>;
    default: return <select className="ppt-select" value={step.textAlign} onChange={(e) => onChange({ ...step, textAlign: e.target.value as 'left' })}><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option><option value="justify">Đều</option></select>;
  }
}

export function MacrosDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [macros, setMacros] = useState<SlideMacro[]>(x.presentation.macros ?? []);
  const [activeId, setActiveId] = useState<string | null>(macros[0]?.id ?? null);
  const active = macros.find((m) => m.id === activeId) ?? null;
  const save = (list: SlideMacro[]) => {
    setMacros(list);
    x.commit((p) => ({ ...p, macros: list }));
  };
  const update = (patch: Partial<SlideMacro>) => active && save(macros.map((m) => (m.id === active.id ? { ...m, ...patch } : m)));
  const create = () => {
    const macro: SlideMacro = { id: `macro-${Date.now()}`, name: `Macro${macros.length + 1}`, steps: [defaultStep('font')] };
    save([...macros, macro]);
    setActiveId(macro.id);
  };
  const run = () => {
    if (!active) return;
    x.commit((p) => runMacro(p, active));
    x.toast(`Đã chạy macro "${active.name}"`);
  };
  return (
    <Dialog title="Macro" onClose={onClose} wide footer={<><button type="button" className="ppt-secondary-action-btn" onClick={onClose}>Đóng</button><button type="button" className="ppt-primary-action-btn" disabled={!active || active.steps.length === 0} onClick={run}>Chạy</button></>}>
      <div className="ppx-macro">
        <div className="ppx-macro-list">
          {macros.map((m) => (
            <button type="button" key={m.id} className={`ppx-list-item ${m.id === activeId ? 'is-active' : ''}`} onClick={() => setActiveId(m.id)}>{m.name}</button>
          ))}
          <button type="button" className="ppt-secondary-action-btn" onClick={create}>Tạo macro</button>
          {active && <button type="button" className="ppt-secondary-action-btn" onClick={() => { save(macros.filter((m) => m.id !== active.id)); setActiveId(null); }}>Xóa macro</button>}
        </div>
        <div className="ppx-macro-body">
          {active ? (
            <>
              <Field label="Tên macro"><input className="ppt-input" value={active.name} onChange={(e) => update({ name: e.target.value })} /></Field>
              <Field label="Mô tả"><input className="ppt-input" value={active.description ?? ''} onChange={(e) => update({ description: e.target.value })} /></Field>
              <div className="ppx-subhead">Các bước (chạy lần lượt trên cả bài)</div>
              {active.steps.map((step, index) => (
                <div key={index} className="ppx-macro-step">
                  <span>{index + 1}.</span>
                  <select className="ppt-select" value={step.op} onChange={(e) => update({ steps: active.steps.map((s, i) => (i === index ? defaultStep(e.target.value as MacroStep['op']) : s)) })}>
                    {MACRO_OPS.map(([op, label]) => <option key={op} value={op}>{label}</option>)}
                  </select>
                  <StepEditor step={step} onChange={(next) => update({ steps: active.steps.map((s, i) => (i === index ? next : s)) })} />
                  <button type="button" className="ppt-tool-btn" onClick={() => update({ steps: active.steps.filter((_, i) => i !== index) })} title="Xóa bước"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="ppt-secondary-action-btn" onClick={() => update({ steps: [...active.steps, defaultStep('replace')] })}>Thêm bước</button>
            </>
          ) : (
            <div className="ppx-muted">Chưa có macro. Bấm "Tạo macro" để ghi một chuỗi thao tác dùng lại nhiều lần.</div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function CropDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const [crop, setCrop] = useState(el?.crop ?? { top: 0, right: 0, bottom: 0, left: 0 });
  const slider = (key: keyof typeof crop, label: string) => (
    <Field label={`${label}: ${crop[key]}%`}>
      <input type="range" min={0} max={45} value={crop[key]} onChange={(e) => setCrop({ ...crop, [key]: Number(e.target.value) })} />
    </Field>
  );
  return (
    <Dialog title="Cắt ảnh" onClose={onClose} width={480} footer={<DialogButtons onCancel={onClose} onOk={() => { if (el) x.updateElement(el.id, { crop }); onClose(); }} okDisabled={!el} />}>
      <div className="ppx-crop-preview">
        {el?.src && <img src={el.src} alt="" style={{ clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)` }} />}
      </div>
      <div className="ppx-grid-2">
        {slider('top', 'Trên')}
        {slider('bottom', 'Dưới')}
        {slider('left', 'Trái')}
        {slider('right', 'Phải')}
      </div>
    </Dialog>
  );
}

export function CompressDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [scope, setScope] = useState<'one' | 'all'>(x.selectedElement?.type === 'image' ? 'one' : 'all');
  const [maxDim, setMaxDim] = useState(1600);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    let before = 0;
    let after = 0;
    const results = new Map<string, string>();
    for (const slide of x.presentation.slides) {
      for (const el of slide.elements) {
        if (el.type !== 'image' || !el.src?.startsWith('data:')) continue;
        if (scope === 'one' && el.id !== x.selectedElement?.id) continue;
        const out = await compressImage(el.src, maxDim).catch(() => null);
        if (!out) continue;
        before += out.before;
        after += out.after;
        results.set(el.id, out.src);
      }
    }
    x.commit((p) => ({ ...p, slides: p.slides.map((s) => ({ ...s, elements: s.elements.map((el) => (results.has(el.id) ? { ...el, src: results.get(el.id) } : el)) })) }));
    setBusy(false);
    x.toast(`Đã nén ${results.size} ảnh: ${formatBytes(before * 0.75)} → ${formatBytes(after * 0.75)}`);
    onClose();
  };
  return (
    <Dialog title="Nén ảnh" onClose={onClose} width={420} footer={<DialogButtons onCancel={onClose} okLabel={busy ? 'Đang nén…' : 'Nén'} okDisabled={busy} onOk={() => void run()} />}>
      <label className="ppt-checkbox-label"><input type="radio" disabled={x.selectedElement?.type !== 'image'} checked={scope === 'one'} onChange={() => setScope('one')} /> Chỉ ảnh đang chọn</label>
      <label className="ppt-checkbox-label"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /> Tất cả ảnh trong bài</label>
      <Field label="Độ phân giải">
        <select className="ppt-select" value={maxDim} onChange={(e) => setMaxDim(Number(e.target.value))}>
          <option value={2560}>Chất lượng cao (2560 px)</option>
          <option value={1600}>In ấn (1600 px)</option>
          <option value={1280}>Trang web (1280 px)</option>
          <option value={800}>Email (800 px)</option>
        </select>
      </Field>
    </Dialog>
  );
}

function useMediaRecorder(kind: 'audio' | 'screen') {
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(() => setElapsed((v) => v + 1000), 1000);
    return () => clearInterval(timer);
  }, [state]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);
  const start = async () => {
    setError('');
    try {
      const stream = kind === 'audio'
        ? await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (kind === 'screen') {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        mic?.getAudioTracks().forEach((t) => stream.addTrack(t));
        stream.getVideoTracks()[0]?.addEventListener('ended', () => recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop());
      }
      streamRef.current = stream;
      const mime = kind === 'audio' ? (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '') : pickRecordingMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        setBlob(new Blob(chunksRef.current, { type: recorder.mimeType.split(';')[0] }));
        stream.getTracks().forEach((t) => t.stop());
        setState('done');
      };
      recorder.start(500);
      recorderRef.current = recorder;
      setElapsed(0);
      setState('recording');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') setError('Bạn chưa cho phép truy cập.');
      else setError(err instanceof Error ? err.message : 'Không bắt đầu ghi được');
    }
  };
  const pause = () => {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state === 'recording') { r.pause(); setState('paused'); } else if (r.state === 'paused') { r.resume(); setState('recording'); }
  };
  const stop = () => recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
  return { state, elapsed, blob, error, start, pause, stop, reset: () => { setBlob(null); setState('idle'); setElapsed(0); } };
}

export function RecordMediaDialog({ onClose, kind }: CloseProps & { kind: 'audio' | 'screen' }) {
  const x = useSlideExtras();
  const rec = useMediaRecorder(kind);
  const previewUrl = rec.blob ? URL.createObjectURL(rec.blob) : '';
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const insert = async () => {
    if (!rec.blob) return;
    const url = await readAsDataUrl(rec.blob);
    const name = kind === 'audio' ? `Ghi âm ${new Date().toLocaleTimeString('vi-VN')}` : `Quay màn hình ${new Date().toLocaleTimeString('vi-VN')}`;
    if (kind === 'audio') x.addElement({ id: newElementId('audio'), type: 'audio', x: 42, y: 44, width: 22, height: 12, name, audioData: { url, name, volume: 1 } });
    else x.addElement({ id: newElementId('video'), type: 'video', x: 10, y: 10, width: 80, height: 80, name, videoData: { url, autoplay: false, loop: false, shape: 'rect' }, altText: name });
    onClose();
  };
  return (
    <Dialog title={kind === 'audio' ? 'Ghi âm' : 'Quay màn hình'} onClose={onClose} width={440} footer={<DialogButtons onCancel={onClose} okLabel="Chèn vào trang" okDisabled={!rec.blob} onOk={() => void insert()} />}>
      {rec.error && <div className="ppx-warn">{rec.error}</div>}
      <div className="ppx-rec-row">
        <span className={`ppx-rec-dot ${rec.state === 'recording' ? 'is-live' : ''}`} />
        <span className="ppx-rec-time">{formatDuration(rec.elapsed)}</span>
        {rec.state === 'idle' || rec.state === 'done' ? (
          <button type="button" className="ppt-primary-action-btn" onClick={() => { rec.reset(); void rec.start(); }}><Circle size={14} /> {rec.state === 'done' ? 'Ghi lại' : 'Bắt đầu ghi'}</button>
        ) : (
          <>
            <button type="button" className="ppt-secondary-action-btn" onClick={rec.pause}>{rec.state === 'paused' ? <Play size={14} /> : <Pause size={14} />} {rec.state === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}</button>
            <button type="button" className="ppt-primary-action-btn" onClick={rec.stop}><Square size={14} /> Dừng</button>
          </>
        )}
      </div>
      {previewUrl && (kind === 'audio' ? <audio src={previewUrl} controls style={{ width: '100%' }} /> : <video src={previewUrl} controls style={{ width: '100%', borderRadius: 8 }} />)}
      {kind === 'screen' && rec.state === 'idle' && <div className="ppx-muted">Chọn cửa sổ hoặc màn hình cần quay. Âm thanh micro được ghi kèm nếu bạn cho phép.</div>}
    </Dialog>
  );
}
