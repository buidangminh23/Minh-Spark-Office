import { useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';
import { isDesktop } from '../lib/desktop';
import './workspaceStatus.css';

type Phase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
const bytes = (value: number) => `${(value / 1048576).toFixed(1)} MB`;

export function DesktopUpdater({ editing }: { editing: boolean }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState('');
  const [nextVersion, setNextVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [automatic, setAutomatic] = useState(() => localStorage.getItem('office-auto-check') !== 'false');
  const update = useRef<Update | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const dialog = useRef<HTMLElement | null>(null);
  const checkUpdate = async (silent = false) => {
    if (busy.current || (silent && update.current)) return;
    busy.current = true;
    setPhase('checking');
    setError('');
    if (!silent) setOpen(true);
    try {
      await update.current?.close();
      update.current = null;
      const result = await check({ timeout: 20000 });
      if (!mounted.current) { await result?.close(); return; }
      update.current = result;
      setPhase(result ? 'available' : 'current');
      setNextVersion(result?.version ?? '');
      setNotes(result?.body ?? '');
      if (result && !silent) setOpen(true);
    } catch {
      if (mounted.current) { setPhase('error'); setError('Không kiểm tra được bản cập nhật. Kiểm tra kết nối mạng rồi thử lại.'); }
    } finally { busy.current = false; }
  };
  useEffect(() => {
    if (!isDesktop()) return;
    mounted.current = true;
    void getVersion().then(setVersion);
    return () => { mounted.current = false; if (!busy.current) void update.current?.close(); };
  }, []);
  useEffect(() => {
    if (!isDesktop()) return;
    const timer = automatic ? setTimeout(() => void checkUpdate(true), 12000) : undefined;
    const interval = automatic ? setInterval(() => void checkUpdate(true), 6 * 60 * 60 * 1000) : undefined;
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [automatic]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, [open]);
  const download = async () => {
    if (!update.current || busy.current) return;
    const selectedUpdate = update.current;
    busy.current = true;
    setError(''); setDownloaded(0); setTotal(0); setPhase('downloading');
    try {
      await selectedUpdate.download((event) => {
        if (!mounted.current) return;
        if (event.event === 'Started') setTotal(event.data.contentLength ?? 0);
        if (event.event === 'Progress') setDownloaded((value) => value + event.data.chunkLength);
      }, { timeout: 120000 });
      if (mounted.current) setPhase('downloaded');
    } catch {
      if (mounted.current) {
        setPhase('available');
        setError('Tải hoặc xác minh chữ ký chưa thành công. App hiện tại vẫn dùng được; hãy thử tải lại.');
      }
    } finally { busy.current = false; if (!mounted.current) await selectedUpdate.close(); }
  };
  const install = async () => {
    if (!update.current || busy.current || editing) return;
    busy.current = true; setPhase('installing'); setError('');
    try { await update.current.install({ restartAfterInstall: true }); }
    catch { setPhase('downloaded'); setError('Chưa khởi chạy được bộ cài. Hãy thử lại.'); busy.current = false; }
  };
  if (!isDesktop()) return null;
  const working = ['checking', 'downloading', 'installing'].includes(phase);
  const percent = total ? Math.min(100, Math.round(downloaded / total * 100)) : null;
  const title = ({ idle: 'Cập nhật Minh Spark Office', checking: 'Đang kiểm tra phiên bản', current: 'Đang dùng phiên bản mới nhất', available: `Đã có phiên bản ${nextVersion}`, downloading: 'Đang tải bản cập nhật', downloaded: 'Bản cập nhật đã sẵn sàng', installing: 'Đang cài đặt bản cập nhật', error: 'Chưa kiểm tra được cập nhật' })[phase];
  return <>
    <button className="update-launcher" onClick={() => { setOpen(true); if (phase === 'idle' || phase === 'error' || phase === 'current') void checkUpdate(); }}>{phase === 'available' || phase === 'downloaded' ? `Có bản mới ${nextVersion}` : 'Cập nhật ứng dụng'}</button>
    {open && <div className="sync-dialog-backdrop"><section className="sync-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="update-title" onKeyDown={(event) => {
      if (event.key === 'Escape' && phase !== 'installing') setOpen(false);
      if (event.key === 'Tab') {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
        if (!items?.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <div className={`update-brand-ring ${working ? 'busy' : ''}`}><img className="sync-brand" src="/logo-icon.png" alt="Minh Spark Office" /></div>
      <h2 id="update-title">{title}</h2>
      <p>Minh Spark Office · Phiên bản {version || '…'}</p>
      {notes && ['available', 'downloaded'].includes(phase) && <div className="update-notes">{notes}</div>}
      {working && <div className="update-progress" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === 'downloading' && percent !== null ? percent : undefined}><div className={`update-progress-fill ${phase !== 'downloading' || percent === null ? 'update-progress-indeterminate' : ''}`} style={phase === 'downloading' && percent !== null ? { width: `${percent}%` } : undefined} /></div>}
      {phase === 'downloading' && <div className="update-metrics"><span>{bytes(downloaded)}{total ? ` / ${bytes(total)}` : ''}</span><strong>{percent === null ? 'Đang tải…' : `${percent}%`}</strong></div>}
      {phase === 'downloaded' && <p>{editing ? 'Lưu và trở về danh sách tài liệu trước khi cài đặt.' : 'Chữ ký gói cập nhật đã được xác minh. Ứng dụng sẽ đóng để cài đặt rồi mở lại.'}</p>}
      {phase === 'installing' && <p>Đang mở bộ cài. Tài liệu đã lưu trên máy vẫn được giữ.</p>}
      {error && <p className="update-error" role="alert">{error}</p>}
      <label className="update-setting"><input type="checkbox" checked={automatic} disabled={working} onChange={(event) => { const value = event.target.checked; setAutomatic(value); localStorage.setItem('office-auto-check', String(value)); }} />Tự động kiểm tra phiên bản mới</label>
      <div className="sync-dialog-actions">
        {phase !== 'installing' && <button className="btn" onClick={() => setOpen(false)}>{phase === 'downloading' ? 'Tải trong nền' : 'Để sau'}</button>}
        {phase === 'available' && <button className="btn btn-primary" onClick={() => void download()}>Tải bản cập nhật</button>}
        {phase === 'downloaded' && <button className="btn btn-primary" disabled={editing} onClick={() => void install()}>Cài đặt và mở lại</button>}
        {['idle', 'current', 'error'].includes(phase) && <button className="btn btn-primary" onClick={() => void checkUpdate()}>Kiểm tra lại</button>}
      </div>
    </section></div>}
  </>;
}
