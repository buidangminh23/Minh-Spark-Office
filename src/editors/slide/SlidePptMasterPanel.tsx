import { useMemo, useRef, useState } from 'react';
import { FileUp, LayoutTemplate, Sparkles, Square, X } from 'lucide-react';
import type { SlideData } from '../../lib/slideTypes';
import { getProviderKey, AddinError, streamAddin } from '../../addins/client';
import { MAX_DIRECT_PDF_BASE64, MAX_SERVER_PDF_BASE64 } from '../../../api/_shared/addin';
import { slideAiProvider } from '../../lib/slideAi';
import { pickFile } from '../../lib/download';
import { PPT_MASTER_ATTRIBUTION, PPT_MASTER_GROUPS, PPT_MASTER_MODES, PPT_MASTER_STYLES, type PptMasterStyle } from '../../lib/pptMaster/catalog';
import { buildDeckPrompt, MAX_PAGES, MIN_PAGES, parseDeck } from '../../lib/pptMaster/deck';
import { renderDeck } from '../../lib/pptMaster/render';
import { readDeckSource, SOURCE_ACCEPT, type DeckSource } from '../../lib/pptMaster/source';
import './slidePptMaster.css';

type Props = { onClose: () => void; onApply: (slides: SlideData[]) => void };
type Phase = { kind: 'idle' } | { kind: 'running'; chars: number } | { kind: 'error'; message: string };

const STORE_KEY = 'minh-slides-ppt-master';
const DEFAULT_PAGES = 10;

type Saved = { styleId: string; modeId: string; pages: number; language: 'vi' | 'en'; aiPalette: boolean };

function loadSaved(): Saved {
  const fallback: Saved = { styleId: 'swiss-minimal', modeId: 'pyramid', pages: DEFAULT_PAGES, language: 'vi', aiPalette: false };
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Saved>) };
  } catch {
    return fallback;
  }
}

function persist(value: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

function StyleSwatch({ style }: { style: PptMasterStyle }) {
  const { palette, radius, outline, motif } = style.tokens;
  return (
    <span className="pm-swatch" style={{ background: palette.background, borderRadius: Math.min(radius, 8) }} aria-hidden>
      {motif === 'band' && <span className="pm-swatch-band" style={{ background: palette.primary }} />}
      <span className="pm-swatch-title" style={{ background: palette.text }} />
      <span className="pm-swatch-line" style={{ background: palette.muted }} />
      <span className="pm-swatch-card" style={{ background: palette.surface, borderRadius: Math.min(radius, 6), border: outline ? `1px solid ${palette.text}` : 'none' }} />
      <span className="pm-swatch-dot" style={{ background: palette.accent }} />
    </span>
  );
}

export function SlidePptMasterPanel({ onClose, onApply }: Props) {
  const [saved, setSaved] = useState(loadSaved);
  const [brief, setBrief] = useState('');
  const [audience, setAudience] = useState('');
  const [source, setSource] = useState<DeckSource | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const update = (patch: Partial<Saved>) => setSaved((current) => {
    const next = { ...current, ...patch };
    persist(next);
    return next;
  });
  const groups = useMemo(() => Object.entries(PPT_MASTER_GROUPS).map(([id, label]) => ({ id, label, styles: PPT_MASTER_STYLES.filter((style) => style.group === id) })), []);
  const running = phase.kind === 'running';
  const canRun = !running && (brief.trim().length > 0 || Boolean(source));

  const attach = async () => {
    const file = await pickFile(SOURCE_ACCEPT);
    if (!file) return;
    try {
      const limit = getProviderKey(slideAiProvider()) ? MAX_DIRECT_PDF_BASE64 : MAX_SERVER_PDF_BASE64;
      setSource(await readDeckSource(file, limit));
      setPhase({ kind: 'idle' });
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Không đọc được tệp này.' });
    }
  };

  const generate = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'running', chars: 0 });
    let raw = '';
    try {
      await streamAddin({
        provider: slideAiProvider(),
        app: 'slide',
        documentName: 'PPT Master',
        turns: [{ role: 'user', content: buildDeckPrompt({ ...saved, brief, audience, hasSource: Boolean(source) }) }],
        context: { label: source?.name ?? 'Không có tài liệu nguồn', text: source?.text ?? '', pdf: source?.pdf },
      }, (chunk) => {
        raw += chunk;
        setPhase({ kind: 'running', chars: raw.length });
      }, controller.signal);
      const slides = renderDeck(parseDeck(raw), saved.styleId);
      onApply(slides);
      onClose();
    } catch (error) {
      if (controller.signal.aborted) setPhase({ kind: 'idle' });
      else setPhase({ kind: 'error', message: error instanceof AddinError || error instanceof Error ? error.message : 'Chưa tạo được bài thuyết trình.' });
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <>
      <div className="ppt-dialog-body pm-body">
        <div className="ppt-dialog-field">
          <label htmlFor="pm-brief">Chủ đề, mục tiêu hoặc dàn ý</label>
          <textarea id="pm-brief" className="ppt-dialog-textarea" rows={3} value={brief} disabled={running} onChange={(e) => setBrief(e.target.value)} placeholder="Ví dụ: Báo cáo kết quả kinh doanh quý III cho Hội đồng quản trị, đề xuất mở rộng sang miền Trung" autoFocus />
        </div>
        <div className="pm-row">
          <div className="ppt-dialog-field pm-grow">
            <label htmlFor="pm-audience">Người xem</label>
            <input id="pm-audience" className="ppt-input" value={audience} disabled={running} onChange={(e) => setAudience(e.target.value)} placeholder="Ban giám đốc, khách hàng, sinh viên…" />
          </div>
          <div className="ppt-dialog-field">
            <label>Tài liệu nguồn</label>
            {source ? (
              <span className="pm-source"><FileUp size={14} /> <span className="pm-source-name" title={source.name}>{source.name}</span><button type="button" className="pm-icon-btn" aria-label="Bỏ tài liệu nguồn" disabled={running} onClick={() => setSource(null)}><X size={14} /></button></span>
            ) : (
              <button type="button" className="ppt-secondary-action-btn" disabled={running} onClick={() => void attach()}><FileUp size={14} /> Chọn tệp (.docx, .pdf, .md, .txt)</button>
            )}
          </div>
        </div>

        <div className="ppt-dialog-field">
          <label>Chế độ trình bày (cách lập luận)</label>
          <div className="pm-modes" role="radiogroup" aria-label="Chế độ trình bày">
            {PPT_MASTER_MODES.map((mode) => (
              <button key={mode.id} type="button" role="radio" aria-checked={saved.modeId === mode.id} className={`pm-mode ${saved.modeId === mode.id ? 'is-on' : ''}`} disabled={running} onClick={() => update({ modeId: mode.id })}>
                <strong>{mode.label}</strong>
                <span>{mode.summary}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ppt-dialog-field">
          <label>Phong cách hình ảnh</label>
          <div className="pm-styles">
            {groups.map((group) => (
              <div key={group.id} className="pm-style-group">
                <span className="pm-group-label">{group.label}</span>
                <div className="pm-style-grid" role="radiogroup" aria-label={group.label}>
                  {group.styles.map((style) => (
                    <button key={style.id} type="button" role="radio" aria-checked={saved.styleId === style.id} title={style.summary} className={`pm-style ${saved.styleId === style.id ? 'is-on' : ''}`} disabled={running} onClick={() => update({ styleId: style.id })}>
                      <StyleSwatch style={style} />
                      <span className="pm-style-name">{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pm-row pm-options">
          <label className="pm-inline">Số trang
            <input className="ppt-input pm-num" type="number" min={MIN_PAGES} max={MAX_PAGES} value={saved.pages} disabled={running} onChange={(e) => update({ pages: Math.min(MAX_PAGES, Math.max(MIN_PAGES, Number(e.target.value) || DEFAULT_PAGES)) })} />
          </label>
          <label className="pm-inline">Ngôn ngữ
            <select className="ppt-select" value={saved.language} disabled={running} onChange={(e) => update({ language: e.target.value === 'en' ? 'en' : 'vi' })}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
            </select>
          </label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={saved.aiPalette} disabled={running} onChange={(e) => update({ aiPalette: e.target.checked })} /> Để AI chọn bảng màu theo chủ đề</label>
        </div>

        {phase.kind === 'running' && <div className="pm-status" role="status">Đang lập kế hoạch và viết {saved.pages} trang… {phase.chars > 0 ? `${phase.chars.toLocaleString('vi-VN')} ký tự` : 'đang kết nối AI'}</div>}
        {phase.kind === 'error' && <div className="pm-status is-error" role="alert">{phase.message}</div>}
        <div className="pm-credit">{PPT_MASTER_ATTRIBUTION}. Bài tạo ra sẽ thay các trang hiện có; bấm Hoàn tác để lấy lại.</div>
      </div>
      <div className="ppt-dialog-footer">
        <button className="ppt-secondary-action-btn" onClick={running ? () => abortRef.current?.abort() : onClose}>{running ? <><Square size={14} /> Dừng</> : 'Đóng'}</button>
        <button className="ppt-primary-action-btn pm-run" disabled={!canRun} onClick={() => void generate()}>
          {running ? <LayoutTemplate size={16} /> : <Sparkles size={16} />} {running ? 'Đang tạo…' : 'Tạo bài bằng PPT Master'}
        </button>
      </div>
    </>
  );
}
