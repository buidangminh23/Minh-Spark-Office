import { useEffect, useState } from 'react';
import { Omega } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { insertMetaImage, loadRecentSymbols, pushRecentSymbol } from '../../insertActions';
import { FLAG_SET_NAME, loadFlags, searchFlags, type FlagEntry } from '../../insertFlags';
import { searchSymbols, SYMBOL_SETS, symbolCode } from '../../insertSymbols';
import Modal from '../Modal';

type Hover = { kind: 'symbol'; value: string } | { kind: 'flag'; flag: FlagEntry } | null;

const FLAG_WIDTH = '24px';

function useFlags(active: boolean) {
  const [flags, setFlags] = useState<FlagEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active || flags) return;
    let alive = true;
    loadFlags().then((list) => { if (alive) setFlags(list); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [active, flags]);
  return { flags, failed };
}

export function SymbolsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [tab, setTab] = useState(SYMBOL_SETS[0].name);
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState<Hover>(null);
  const [recent, setRecent] = useState(loadRecentSymbols);
  const searching = Boolean(query.trim());
  const onFlags = !searching && tab === FLAG_SET_NAME;
  const { flags, failed } = useFlags(onFlags || searching);
  const symbols = searching ? searchSymbols(query) : onFlags ? [] : SYMBOL_SETS.find((set) => set.name === tab)?.symbols ?? [];
  const flagList = flags ? (searching ? searchFlags(flags, query) : onFlags ? flags : []) : [];
  const insertSymbol = (text: string) => {
    ctx.editor.chain().focus().insertContent(text).run();
    pushRecentSymbol(text);
    setRecent(loadRecentSymbols());
  };
  const insertFlag = (flag: FlagEntry) => insertMetaImage(ctx, { src: flag.src, alt: `Cờ ${flag.name}`, width: FLAG_WIDTH });
  const shown: Hover = hover ?? (symbols[0] ? { kind: 'symbol', value: symbols[0] } : flagList[0] ? { kind: 'flag', flag: flagList[0] } : null);
  const loadingFlags = (onFlags || searching) && !flags && !failed;
  return (
    <Modal title="Ký hiệu & biểu tượng" subtitle="Nhấp để chèn. Tìm bằng ký tự, mã Unicode (ví dụ 2605) hoặc tên nước." icon={<Omega size={20} />} onClose={onClose} width={860}>
      <div className="symbol-recent">{recent.map((s) => <button key={s} type="button" className="symbol-cell" title={symbolCode(s)} onMouseEnter={() => setHover({ kind: 'symbol', value: s })} onClick={() => insertSymbol(s)}>{s}</button>)}</div>
      <div className="symbol-layout">
        <div className="symbol-sets">
          <input className="text-field" placeholder="Tìm ký hiệu, mã U+… hoặc tên nước" value={query} onChange={(e) => setQuery(e.target.value)} />
          {SYMBOL_SETS.map((set) => <button key={set.name} type="button" className={`symbol-set ${!searching && tab === set.name ? 'on' : ''}`} onClick={() => { setQuery(''); setTab(set.name); }}>{set.name}<span>{set.symbols.length}</span></button>)}
          <button type="button" className={`symbol-set ${onFlags ? 'on' : ''}`} onClick={() => { setQuery(''); setTab(FLAG_SET_NAME); }}>{FLAG_SET_NAME}<span>{flags?.length ?? ''}</span></button>
        </div>
        <div className="symbol-grid-scroll symbol-results" onMouseLeave={() => setHover(null)}>
          {symbols.length > 0 && (
            <div className="symbol-grid">
              {symbols.map((s, i) => <button key={`${s}-${i}`} type="button" className="symbol-cell" title={symbolCode(s)} onMouseEnter={() => setHover({ kind: 'symbol', value: s })} onClick={() => insertSymbol(s)}>{s}</button>)}
            </div>
          )}
          {flagList.length > 0 && (
            <div className="flag-grid">
              {flagList.map((flag) => <button key={flag.code} type="button" className="flag-cell" title={flag.name} aria-label={`Cờ ${flag.name}`} onMouseEnter={() => setHover({ kind: 'flag', flag })} onClick={() => insertFlag(flag)}><img src={flag.src} alt="" /></button>)}
            </div>
          )}
          {loadingFlags && <div className="panel-empty">Đang tải cờ các nước…</div>}
          {failed && (onFlags || searching) && <div className="panel-empty">Không tải được bộ cờ. Kiểm tra kết nối rồi mở lại.</div>}
          {!loadingFlags && symbols.length === 0 && flagList.length === 0 && !failed && <div className="panel-empty">Không có ký hiệu nào khớp.</div>}
        </div>
        <div className="symbol-preview">
          {shown?.kind === 'flag' ? (
            <>
              <div className="symbol-preview-glyph"><img className="flag-preview" src={shown.flag.src} alt="" /></div>
              <strong className="flag-preview-name">{shown.flag.name}</strong>
              <code>{shown.flag.code}</code>
              <button className="btn btn-primary" onClick={() => insertFlag(shown.flag)}>Chèn</button>
            </>
          ) : (
            <>
              <div className="symbol-preview-glyph">{shown?.value ?? ''}</div>
              <code>{shown ? symbolCode(shown.value) : ''}</code>
              <button className="btn btn-primary" disabled={!shown} onClick={() => shown && insertSymbol(shown.value)}>Chèn</button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
