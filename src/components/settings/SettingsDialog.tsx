import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Settings, X } from 'lucide-react';
import { setSettings, useSettings, type AppSettings } from '../../lib/appSettings';
import { CATEGORIES, optionText } from './catalog';
import { GROUP_TITLES, type SettingCategory, type SettingGroup, type SettingOption, type SettingSection } from './types';
import { NumberField, Segmented, Select, TextField, Toggle } from './controls';
import { SettingsActionsContext } from './settingsShared';
import './settings.css';

const SEARCH_MIN = 2;

function OptionControl({ option, settings }: { option: Exclude<SettingOption, { kind: 'custom' }>; settings: AppSettings }) {
  const value = settings[option.key];
  const disabled = option.disabledWhen?.(settings) ?? false;
  const set = (next: unknown) => setSettings({ [option.key]: next } as Partial<AppSettings>);
  switch (option.kind) {
    case 'toggle':
      return <Toggle label={option.label} checked={Boolean(value)} disabled={disabled} onChange={set} />;
    case 'select':
      return <Select label={option.label} value={value as string | number} options={option.options} onChange={set} />;
    case 'segmented':
      return <Segmented label={option.label} value={value as string} options={option.options} onChange={set} />;
    case 'number':
      return <NumberField label={option.label} value={Number(value)} min={option.min} max={option.max} step={option.step} suffix={option.suffix} onChange={set} />;
    case 'text':
      return <TextField label={option.label} value={String(value)} placeholder={option.placeholder} maxLength={option.maxLength} onChange={set} />;
  }
}

function OptionRow({ option, settings }: { option: SettingOption; settings: AppSettings }) {
  if (option.kind === 'custom') {
    return (
      <div className="st-custom">
        <span className="st-row-label">{option.label}</span>
        {option.render()}
      </div>
    );
  }
  const disabled = option.disabledWhen?.(settings) ?? false;
  return (
    <div className={`st-row${disabled ? ' is-disabled' : ''}`}>
      <span className="st-row-text">
        <span className="st-row-label">{option.label}{option.mark && <span className="st-mark" aria-hidden="true">{option.mark}</span>}</span>
        {option.hint && <span className="st-row-hint">{option.hint}</span>}
      </span>
      <span className="st-row-control"><OptionControl option={option} settings={settings} /></span>
    </div>
  );
}

function SectionCard({ section, options, settings, caption }: { section: SettingSection; options: SettingOption[]; settings: AppSettings; caption?: string }) {
  return (
    <section className="st-card" aria-labelledby={`st-${section.id}`}>
      <div className="st-card-head">
        <span className="st-card-icon" aria-hidden="true">{section.icon}</span>
        <span>
          {caption && <span className="st-card-caption">{caption}</span>}
          <h3 id={`st-${section.id}`}>{section.title}</h3>
          <p>{section.description}</p>
        </span>
      </div>
      <div className="st-card-body">
        {options.map((option) => <OptionRow key={option.kind === 'custom' ? option.id : `${option.key}-${option.label}`} option={option} settings={settings} />)}
      </div>
    </section>
  );
}

const visibleOptions = (section: SettingSection) => section.options.filter((option) => option.visible?.() ?? true);

function searchResults(query: string) {
  const needle = query.trim().toLocaleLowerCase('vi');
  return CATEGORIES.flatMap((category) => category.sections.map((section) => {
    const sectionHit = `${section.title} ${section.description} ${category.title}`.toLocaleLowerCase('vi').includes(needle);
    const options = visibleOptions(section).filter((option) => sectionHit || optionText(option).includes(needle));
    return { category, section, options };
  })).filter((result) => result.options.length);
}

export function SettingsDialog({ onClose, onExportBackup, onImportBackup, initialCategory = 'general' }: {
  onClose: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  initialCategory?: string;
}) {
  const settings = useSettings();
  const [active, setActive] = useState(initialCategory);
  const [query, setQuery] = useState('');
  const content = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const actions = useMemo(() => ({ onExportBackup, onImportBackup, onClose }), [onExportBackup, onImportBackup, onClose]);
  const category = CATEGORIES.find((item) => item.id === active) ?? CATEGORIES[0];
  const searching = query.trim().length >= SEARCH_MIN;
  const results = useMemo(() => (searching ? searchResults(query) : []), [query, searching]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const open = (next: SettingCategory) => {
    setActive(next.id);
    setQuery('');
    content.current?.scrollTo({ top: 0 });
  };

  return (
    <SettingsActionsContext.Provider value={actions}>
      <div className="st-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="st-dialog" role="dialog" aria-modal="true" aria-labelledby="st-title" ref={dialog} tabIndex={-1}>
          <aside className="st-nav">
            <div className="st-brand">
              <img src="/logo-icon.png" alt="" width="40" height="40" />
              <span>Minh Spark<br />Office</span>
            </div>
            <nav aria-label="Mục cài đặt">
              {CATEGORIES.map((item, index) => (
                <Fragment key={item.id}>
                {item.group !== CATEGORIES[index - 1]?.group && <span className="st-nav-group">{GROUP_TITLES[item.group as SettingGroup]}</span>}
                <button type="button" className={`st-nav-item${!searching && item.id === category.id ? ' is-active' : ''}`} aria-current={!searching && item.id === category.id ? 'page' : undefined} onClick={() => open(item)}>
                  <span aria-hidden="true">{item.icon}</span>{item.title}
                </button>
                </Fragment>
              ))}
            </nav>
          </aside>
          <div className="st-main">
            <header className="st-header">
              <span className="st-header-icon" aria-hidden="true"><Settings size={26} /></span>
              <span className="st-header-text">
                <h2 id="st-title">Cài đặt</h2>
                <p>Tuỳ chỉnh trải nghiệm Office 23 theo nhu cầu của bạn.</p>
              </span>
              <label className="st-search">
                <Search size={18} aria-hidden="true" />
                <input type="search" placeholder="Tìm trong cài đặt…" aria-label="Tìm trong cài đặt" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <button type="button" className="st-close" aria-label="Đóng" onClick={onClose}><X size={22} /></button>
            </header>
            <div className="st-content" ref={content}>
              {searching ? (
                results.length ? results.map(({ category: owner, section, options }) => (
                  <SectionCard key={`${owner.id}-${section.id}`} section={section} options={options} settings={settings} caption={`${GROUP_TITLES[owner.group]} · ${owner.title}`} />
                )) : <p className="st-empty st-empty-search">Không tìm thấy cài đặt nào khớp “{query.trim()}”.</p>
              ) : (
                <>
                  <div className="st-page-head">
                    {category.group !== 'general' && <span className="st-card-caption">{GROUP_TITLES[category.group]}</span>}
                    <h3>{category.title}</h3>
                    <p>{category.description}</p>
                  </div>
                  {category.sections.map((section) => {
                    const options = visibleOptions(section);
                    return options.length ? <SectionCard key={section.id} section={section} options={options} settings={settings} /> : null;
                  })}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </SettingsActionsContext.Provider>
  );
}
