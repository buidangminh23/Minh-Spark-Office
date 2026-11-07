import { useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { isDesktop } from '../lib/desktop';
import { saveAndCloseActiveDocument } from '../lib/documentCloser';
import { clearDockProgress, requestDockAttention, showDockProgress } from '../lib/desktopProgress';
import { UpdateProgressRing, type RingMode } from './UpdateProgressRing';
import './workspaceStatus.css';

type Phase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
const bytes = (value: number) => `${(value / 1048576).toFixed(1)} MB`;
const ringModes: Record<Phase, RingMode> = { idle: 'idle', checking: 'spinning', current: 'complete', available: 'idle', downloading: 'progress', downloaded: 'complete', installing: 'spinning', error: 'error' };
const AUTO_CHECK_MS = 15 * 60 * 1000;
const FIRST_CHECK_MS = 3000;
const INSTALL_COUNTDOWN_SECONDS = 10;
const CheckMark = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>;

export function DesktopUpdater({ editing }: { editing: boolean }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState('');
  const [nextVersion, setNextVersion] = useState('');
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [automatic, setAutomatic] = useState(() => localStorage.getItem('office-auto-check') !== 'false');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [postponed, setPostponed] = useState(false);
  const update = useRef<Update | null>(null);
  const ready = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const dialog = useRef<HTMLElement | null>(null);
  const checkUpdate = async (silent = false) => {
    if (busy.current || (silent && ready.current)) return;
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
      if (result && !silent) setOpen(true);
    } catch {
      if (mounted.current) {
        if (silent) setPhase('idle');
        else { setPhase('error'); setError('Không kiểm tra được bản cập nhật. Kiểm tra kết nối mạng rồi thử lại.'); }
      }
    } finally { busy.current = false; }
  };
  useEffect(() => {
    if (!isDesktop()) return;
    mounted.current = true;
    void getVersion().then(setVersion);
    return () => { mounted.current = false; if (!busy.current) void update.current?.close(); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, [open]);
  const fetchUpdate = async (selectedUpdate: Update) => {
    setDownloaded(0); setTotal(0);
    await selectedUpdate.download((event) => {
      if (!mounted.current) return;
      if (event.event === 'Started') setTotal(event.data.contentLength ?? 0);
      if (event.event === 'Progress') setDownloaded((value) => value + event.data.chunkLength);
    }, { timeout: 120000 });
  };
  const download = async () => {
    if (!update.current || busy.current) return;
    busy.current = true;
    setError(''); setPhase('downloading');
    try {
      try {
        await fetchUpdate(update.current);
      } catch {
        const latest = await check({ timeout: 20000 });
        if (!latest) throw new Error('No update available');
        await update.current?.close();
        update.current = latest;
        if (mounted.current) setNextVersion(latest.version);
        await fetchUpdate(latest);
      }
      if (mounted.current) { ready.current = true; setPhase('downloaded'); }
    } catch {
      if (mounted.current) {
        setPhase('available');
        setError('Tải hoặc xác minh chữ ký chưa thành công. App hiện tại vẫn dùng được; hãy thử tải lại.');
      }
    } finally { busy.current = false; if (!mounted.current) await update.current?.close(); }
  };
  const install = async () => {
    if (!update.current || busy.current) return;
    busy.current = true; setError('');
    if (editing && !(await saveAndCloseActiveDocument())) {
      busy.current = false;
      setPostponed(true);
      setError('Chưa lưu được tài liệu đang mở nên chưa cài. Hãy lưu tài liệu rồi thử lại.');
      return;
    }
    setPhase('installing');
    try {
      await update.current.install({ restartAfterInstall: true });
      if (/Mac/.test(navigator.platform)) await relaunch();
    }
    catch { setPostponed(true); setPhase('downloaded'); setError('Chưa khởi chạy được bộ cài. Hãy thử lại.'); busy.current = false; }
  };
  const autoUpdate = async () => {
    await checkUpdate(true);
    if (update.current && !ready.current) await download();
  };
  const latestActions = useRef({ autoUpdate, install });
  useEffect(() => { latestActions.current = { autoUpdate, install }; });
  useEffect(() => {
    if (!isDesktop() || !automatic) return;
    const timer = setTimeout(() => void latestActions.current.autoUpdate(), FIRST_CHECK_MS);
    const interval = setInterval(() => void latestActions.current.autoUpdate(), AUTO_CHECK_MS);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [automatic]);
  useEffect(() => {
    if (phase !== 'downloaded' || !automatic || editing || postponed) { setCountdown(null); return; }
    setOpen(true);
    setCountdown(INSTALL_COUNTDOWN_SECONDS);
  }, [phase, automatic, editing, postponed]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { setCountdown(null); void latestActions.current.install(); return; }
    const tick = setTimeout(() => setCountdown((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(tick);
  }, [countdown]);
  const percent = total ? Math.min(100, Math.round(downloaded / total * 100)) : null;
  useEffect(() => {
    if (phase === 'downloading') showDockProgress(percent ?? 0);
    else clearDockProgress();
    if (phase === 'downloaded') requestDockAttention();
  }, [phase, percent]);
  useEffect(() => () => clearDockProgress(), []);
  if (!isDesktop()) return null;
  const working = ['checking', 'downloading', 'installing'].includes(phase);
  const ringMode: RingMode = phase === 'downloading' && percent === null ? 'spinning' : ringModes[phase];
  const launcherLabel = phase === 'downloading' ? (percent === null ? 'Đang tải bản mới…' : `Đang tải ${percent}%`) : phase === 'downloaded' ? `Cài bản mới ${nextVersion}` : phase === 'available' ? `Có bản mới ${nextVersion}` : 'Cập nhật ứng dụng';
  const title = ({ idle: 'Cập nhật Minh Spark Office', checking: 'Đang kiểm tra phiên bản', current: 'Đang dùng phiên bản mới nhất', available: `Đã có phiên bản ${nextVersion}`, downloading: 'Đang tải bản cập nhật', downloaded: `Bản ${nextVersion} đã sẵn sàng`, installing: 'Đang cài đặt bản cập nhật', error: 'Chưa kiểm tra được cập nhật' })[phase];
  return <>
    <button className={`update-launcher update-launcher-${phase}`} onClick={() => { setOpen(true); if (phase === 'idle' || phase === 'error' || phase === 'current') void checkUpdate(); }}>
      {phase === 'downloading' && <UpdateProgressRing mode={percent === null ? 'spinning' : 'progress'} percent={percent ?? 0} size={16} stroke={2} />}
      {phase === 'downloaded' && <span className="update-launcher-check"><CheckMark /></span>}
      <span>{launcherLabel}</span>
    </button>
    {open && <div className="sync-dialog-backdrop update-dialog-backdrop"><section className="sync-dialog update-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="update-title" onKeyDown={(event) => {
      if (event.key === 'Escape' && phase !== 'installing') setOpen(false);
      if (event.key === 'Tab') {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
        if (!items?.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <div className="update-ring" role={working ? 'progressbar' : undefined} aria-label={working ? title : undefined} aria-valuemin={working ? 0 : undefined} aria-valuemax={working ? 100 : undefined} aria-valuenow={ringMode === 'progress' && percent !== null ? percent : undefined}>
        <UpdateProgressRing mode={ringMode} percent={percent ?? 0} size={104} stroke={4} />
        <div className="update-brand-ring"><img className="sync-brand" src="/logo-icon.png" alt="Minh Spark Office" /></div>
        {ringMode === 'complete' && <span className="update-ring-check"><CheckMark /></span>}
      </div>
      <div className="update-phase" key={phase}>
        <h2 id="update-title">{title}</h2>
        <p>{nextVersion && ['available', 'downloading', 'downloaded', 'installing'].includes(phase) ? `Đang dùng ${version || '…'} · Bản mới ${nextVersion}` : `Minh Spark Office · Phiên bản ${version || '…'}`}</p>
      </div>
      {phase === 'downloading' && <div className="update-metrics"><span>{bytes(downloaded)}{total ? ` / ${bytes(total)}` : ''}</span><strong>{percent === null ? 'Đang tải…' : `${percent}%`}</strong></div>}
      {phase === 'downloaded' && editing && <p>Tài liệu đang mở sẽ được lưu và đóng trước khi cài.</p>}
      {phase === 'downloaded' && countdown !== null && <p>Tự cài đặt và mở lại sau {countdown} giây.</p>}
      {phase === 'installing' && <p>Đang mở bộ cài. Tài liệu đã lưu trên máy vẫn được giữ.</p>}
      {error && <p className="update-error" role="alert">{error}</p>}
      <label className="update-setting"><input type="checkbox" checked={automatic} disabled={working} onChange={(event) => { const value = event.target.checked; setAutomatic(value); localStorage.setItem('office-auto-check', String(value)); }} />Tự động cập nhật để app luôn giống bản web</label>
      <div className="sync-dialog-actions">
        {phase !== 'installing' && <button className="btn" onClick={() => { if (phase === 'downloaded') setPostponed(true); setOpen(false); }}>{phase === 'downloading' ? 'Tải trong nền' : 'Để sau'}</button>}
        {phase === 'available' && <button className="btn btn-primary" onClick={() => void download()}>Tải bản cập nhật</button>}
        {phase === 'downloaded' && <button className="btn btn-primary" onClick={() => void install()}>{editing ? 'Lưu, cài đặt và mở lại' : 'Cài đặt và mở lại'}</button>}
        {['idle', 'current', 'error'].includes(phase) && <button className="btn btn-primary" onClick={() => void checkUpdate()}>Kiểm tra lại</button>}
      </div>
    </section></div>}
  </>;
}
