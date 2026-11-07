import { useMemo, useRef, useState } from 'react';
import { ChevronDown, HardDrive } from 'lucide-react';
import { FONT_CATALOG, GROUP_LABELS, ensureFont, isFontAvailable, loadLocalFonts, recentFonts, rememberFont, type FontEntry, type FontGroup } from '../fonts';
import { usePopover } from './RibbonParts';

const GROUP_ORDER: FontGroup[] = ['system', 'sans', 'serif', 'display', 'handwriting', 'mono', 'local'];
let localCache: string[] | null = null;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function FontPicker({ value, onPick, onError }: { value: string; onPick: (font: string) => void; onError: (message: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<string[]>(localCache ?? []);
  const [groupFilter, setGroupFilter] = useState<FontGroup | 'all'>('all');
  const input = useRef<HTMLInputElement | null>(null);
  const catalog = useMemo<FontEntry[]>(() => {
    const known = new Set(FONT_CATALOG.map((f) => f.name));
    return [...FONT_CATALOG, ...local.filter((name) => !known.has(name)).map((name) => ({ name, group: 'local' as const }))];
  }, [local]);
  const recents = open ? recentFonts() : [];
  const matches = catalog.filter((f) => (groupFilter === 'all' || f.group === groupFilter) && fold(f.name).includes(fold(query)));
  const pick = (name: string) => {
    ensureFont(name);
    rememberFont(name);
    onPick(name);
    setOpen(false);
    setQuery('');
  };
  const scanLocal = async () => {
    try {
      localCache = await loadLocalFonts();
      setLocal(localCache);
      setGroupFilter('local');
    } catch (error) {
      onError((error as Error).message);
    }
  };
  const renderItem = (font: FontEntry | { name: string; group: FontGroup; google?: boolean }) => {
    const available = isFontAvailable(font.name);
    return (
      <button key={`${font.group}-${font.name}`} type="button" role="option" aria-selected={font.name === value} className={`font-item ${font.name === value ? 'active' : ''} ${available ? '' : 'missing'}`}
        onMouseEnter={() => font.group !== 'local' && 'google' in font && font.google && ensureFont(font.name)} onClick={() => pick(font.name)} title={available ? font.name : `${font.name} — máy này chưa cài, sẽ hiển thị bằng phông thay thế`}>
        <span style={{ fontFamily: `"${font.name}", sans-serif` }}>{font.name}</span>
        {'google' in font && font.google && <span className="font-badge">G</span>}
      </button>
    );
  };
  return (
    <div className="ribbon-dropdown font-picker" ref={ref}>
      <button type="button" className="ribbon-select font-select" title="Phông chữ" aria-haspopup="listbox" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (!open) setQuery(''); setOpen(!open); setTimeout(() => input.current?.focus(), 0); }} style={{ fontFamily: `"${value}", sans-serif` }}>
        <span>{value}</span><ChevronDown size={11} />
      </button>
      {open && (
        <div className="ribbon-menu font-menu" role="listbox">
          <input ref={input} className="text-field" placeholder="Tìm phông chữ…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) pick(matches[0].name); }} />
          <div className="font-filters">
            {(['all', ...GROUP_ORDER] as const).filter((g) => g !== 'local' || local.length).map((g) => (
              <button key={g} type="button" className={`find-opt ${groupFilter === g ? 'on' : ''}`} onClick={() => setGroupFilter(g)}>{g === 'all' ? 'Tất cả' : GROUP_LABELS[g].split(' (')[0]}</button>
            ))}
          </div>
          <div className="font-list">
            {!query && groupFilter === 'all' && recents.length > 0 && (
              <>
                <div className="ribbon-menu-heading">Dùng gần đây</div>
                {recents.map((name) => renderItem(catalog.find((f) => f.name === name) ?? { name, group: 'local' }))}
              </>
            )}
            {GROUP_ORDER.map((group) => {
              const items = matches.filter((f) => f.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <div className="ribbon-menu-heading">{GROUP_LABELS[group]} ({items.length})</div>
                  {items.map(renderItem)}
                </div>
              );
            })}
            {!matches.length && <div className="ribbon-menu-empty">Không thấy “{query}”. <button type="button" className="find-opt link" onClick={() => pick(query.trim())}>Dùng tên này</button></div>}
          </div>
          <button type="button" className="ribbon-menu-item" onClick={() => void scanLocal()}><span className="menu-icon"><HardDrive size={14} /></span><span className="menu-label">{local.length ? `Đã đọc ${local.length} phông trên máy — đọc lại` : 'Hiện mọi phông đã cài trên máy…'}</span></button>
        </div>
      )}
    </div>
  );
}
