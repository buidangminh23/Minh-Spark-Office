import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Lightbulb, Search, X } from 'lucide-react';
import { closeAddin, useOpenAddin } from '../../addins/store';
import { TIPS, TIPS_APP_NAME, type Tip, type TipsApp } from './tipsContent';
import { filterSections } from './tipsSearch';
import { closeTips, setTipsOpen, useTipsOpen } from './tipsStore';
import './tips.css';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MAC_KEYS: Record<string, string> = { Ctrl: '⌘', Alt: '⌥', Shift: '⇧' };

const keyLabel = (key: string) => (IS_MAC ? MAC_KEYS[key] ?? key : key);

function KeyCombo({ combo }: { combo: string[] }) {
  return (
    <span className="tips-combo" data-no-translate>
      {combo.map((key, index) => (
        <span key={`${key}-${index}`} className="tips-combo-part">
          {index > 0 && <span className="tips-plus">+</span>}
          <kbd>{keyLabel(key)}</kbd>
        </span>
      ))}
    </span>
  );
}

function TipItem({ tip }: { tip: Tip }) {
  return (
    <li className="tips-item">
      <div className="tips-item-title">{tip.title}</div>
      {tip.keys && tip.keys.length > 0 && (
        <div className="tips-keys">
          {tip.keys.map((combo) => <KeyCombo key={combo.join('+')} combo={combo} />)}
        </div>
      )}
      <p className="tips-item-body">{tip.body}</p>
    </li>
  );
}

function TipsPane({ app }: { app: TipsApp }) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const sections = useMemo(() => filterSections(TIPS[app], query), [app, query]);
  const searching = query.trim().length > 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.querySelector('.tips-pane')?.contains(document.activeElement)) closeTips();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <aside className={`tips-pane tips-pane-${app}`} aria-label={`Mẹo dùng ${TIPS_APP_NAME[app]}`}>
      <header className="tips-head">
        <Lightbulb size={20} className="tips-head-icon" />
        <div className="tips-title">
          <strong>Mẹo dùng {TIPS_APP_NAME[app]}</strong>
          <span>Phím tắt và tính năng giúp làm nhanh hơn</span>
        </div>
        <button type="button" className="icon-btn" title="Đóng" aria-label="Đóng mẹo" onClick={closeTips}><X size={16} /></button>
      </header>

      <label className="tips-search">
        <Search size={14} />
        <input type="search" value={query} placeholder="Tìm mẹo, ví dụ: in, macro, F5" onChange={(event) => setQuery(event.target.value)} />
      </label>

      <div className="tips-body">
        {sections.length === 0 && <p className="tips-empty">{`Không có mẹo nào khớp với “${query.trim()}”.`}</p>}
        {sections.map((section) => {
          const open = searching || !collapsed.has(section.id);
          return (
            <section key={section.id} className="tips-section">
              <button type="button" className="tips-section-head" aria-expanded={open} onClick={() => toggle(section.id)}>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{section.title}</span>
                <span className="tips-count">{section.tips.length}</span>
              </button>
              {open && <ul className="tips-list">{section.tips.map((tip) => <TipItem key={tip.title} tip={tip} />)}</ul>}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

export function TipsPanel({ app }: { app: TipsApp }) {
  const open = useTipsOpen();
  const addin = useOpenAddin();
  useEffect(() => closeTips, []);
  useEffect(() => {
    if (addin) closeTips();
  }, [addin]);
  if (!open) return null;
  return <TipsPane app={app} />;
}

export function TipsRibbonButton({ className, activeClass = 'active' }: { className: string; activeClass?: string }) {
  const open = useTipsOpen();
  const toggle = () => {
    if (!open) closeAddin();
    setTipsOpen(!open);
  };
  return (
    <button
      type="button"
      className={`${className} ${open ? activeClass : ''}`}
      title="Mẹo dùng phím tắt và tính năng"
      aria-label="Mẹo dùng phím tắt và tính năng"
      aria-pressed={open}
      onMouseDown={(event) => event.preventDefault()}
      onClick={toggle}
    >
      <Lightbulb size={20} color="#d97706" />
      <span>Tips</span>
    </button>
  );
}
