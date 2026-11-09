import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Download } from 'lucide-react';
import './downloadMenu.css';

const platforms = [{ label: 'Windows', anchor: 'windows' }, { label: 'macOS', anchor: 'macos' }];

export function DownloadMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const links = useRef<Array<HTMLAnchorElement | null>>([]);
  const initialFocus = useRef(0);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    links.current[initialFocus.current]?.focus();
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, [open]);

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    const current = links.current.findIndex((link) => link === document.activeElement);
    const next = event.key === 'ArrowDown' ? (current + 1) % platforms.length
      : event.key === 'ArrowUp' ? (current + platforms.length - 1) % platforms.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? platforms.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); links.current[next]?.focus(); }
  };

  return <div className="download-menu" ref={container} onKeyDown={handleKeys}>
    <button className="btn download-menu-trigger" type="button" ref={trigger} id={`${id}-trigger`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label="Tải ứng dụng"
      onClick={() => { initialFocus.current = 0; setOpen((current) => !current); }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        initialFocus.current = event.key === 'ArrowUp' ? platforms.length - 1 : 0;
        setOpen(true);
      }}>
      <Download size={20} aria-hidden="true" /><span className="download-menu-label">Tải ứng dụng</span>
    </button>
    {open && <div className="download-menu-options" role="menu" id={id} aria-labelledby={`${id}-trigger`}>
      {platforms.map((platform, index) => <a key={platform.anchor} role="menuitem" tabIndex={-1} ref={(element) => { links.current[index] = element; }}
        href={`https://office.minhspark.com/tai-ung-dung.html#${platform.anchor}`} target="_blank" rel="noopener noreferrer" onClick={() => { setOpen(false); trigger.current?.focus(); }}>
        {platform.label}
      </a>)}
    </div>}
  </div>;
}
