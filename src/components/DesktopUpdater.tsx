import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { isDesktop } from '../lib/desktop';
import { saveActiveDocumentForExit } from '../lib/documentCloser';
import { installAfterDocumentSave } from '../lib/desktopClose';
import { acquireWorkspaceExit } from '../lib/workspaceLifecycle';
import { clearDockProgress, requestDockAttention, showDockProgress } from '../lib/desktopProgress';
import { UpdateProgressRing, type RingMode } from './UpdateProgressRing';
import './workspaceStatus.css';
import { UPDATE_EVENTS } from './settings/settingsShared';
import { publishUpdaterStatus } from '../lib/updaterStatus';

type Phase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
const bytes = (value: number) => `${(value / 1048576).toFixed(1)} MB`;
const ringModes: Record<Phase, RingMode> = { idle: 'idle', checking: 'spinning', current: 'complete', available: 'idle', downloading: 'progress', downloaded: 'complete', installing: 'spinning', error: 'error' };
const AUTO_CHECK_MS = 15 * 60 * 1000;
const FIRST_CHECK_MS = 3000;
const FOCUS_CHECK_MS = 60 * 1000;
const INSTALL_COUNTDOWN_SECONDS = 10;
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const AUTO_RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
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
  const editingNow = useRef(editing);
  useEffect(() => { editingNow.current = editing; }, [editing]);
  const autoRun = useRef(0);
  const autoInFlight = useRef(false);
  const failedDownload = useRef<{ version: string; at: number } | null>(null);
  const checkFromSettings = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!isDesktop()) return;
    const onCheck = () => checkFromSettings.current();
    const onAuto = (event: Event) => {
      const value = Boolean((event as CustomEvent<boolean>).detail);
      if (!value) autoRun.current += 1;
      setAutomatic(value);
    };
    window.addEventListener(UPDATE_EVENTS.check, onCheck);
    window.addEventListener(UPDATE_EVENTS.auto, onAuto);
    return () => {
      window.removeEventListener(UPDATE_EVENTS.check, onCheck);
      window.removeEventListener(UPDATE_EVENTS.auto, onAuto);
    };
  }, []);
  checkFromSettings.current = () => { setOpen(true); if (phase === 'idle' || phase === 'error' || phase === 'current') void checkUpdate(); };
  const checkUpdate = async (silent = false) => {
    if (busy.current) return;
    busy.current = true;
    const hasDownload = ready.current;
    if (!silent || !hasDownload) setPhase('checking');
    setError('');
    if (!silent) setOpen(true);
    try {
      const result = await check({ timeout: 20000 });
      if (!mounted.current) { await result?.close(); return; }
      if (hasDownload && result && result.version === update.current?.version) {
        await result.close();
        setPhase('downloaded');
        return;
      }
      await update.current?.close();
      update.current = result;
      ready.current = false;
      setPhase(result ? 'available' : 'current');
      setNextVersion(result?.version ?? '');
      if (result && !silent) setOpen(true);
    } catch {
      if (mounted.current) {
        if (hasDownload) setPhase('downloaded');
        else if (silent) setPhase('idle');
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
    }, { timeout: DOWNLOAD_TIMEOUT_MS });
  };
  const download = async () => {
    if (!update.current || busy.current) return;
    busy.current = true;
    setError(''); setPhase('downloading');
    const attempted = update.current.version;
    try {
      try {
        await fetchUpdate(update.current);
      } catch (failure) {
        const latest = await check({ timeout: 20000 });
        if (!latest || latest.version === attempted) { await latest?.close(); throw failure; }
        await update.current?.close();
        update.current = latest;
        if (mounted.current) setNextVersion(latest.version);
        await fetchUpdate(latest);
      }
      failedDownload.current = null;
      if (mounted.current) { ready.current = true; setPhase('downloaded'); }
    } catch {
      failedDownload.current = { version: update.current?.version ?? attempted, at: Date.now() };
      if (mounted.current) {
        setPhase('available');
        setError('Tải hoặc xác minh chữ ký chưa thành công. App hiện tại vẫn dùng được; hãy thử tải lại.');
      }
    } finally { busy.current = false; if (!mounted.current) await update.current?.close(); }
  };
  const install = async (run?: number) => {
    if (!update.current || busy.current) return;
    const automaticRun = run !== undefined;
    const stillWanted = () => !automaticRun || (run === autoRun.current && !editingNow.current);
    autoInFlight.current = automaticRun;
    try {
      await checkUpdate(true);
      if (!stillWanted()) return;
      if (!ready.current) await download();
      if (!ready.current || !update.current || busy.current || !stillWanted()) return;
    } finally { autoInFlight.current = false; }
    busy.current = true; setError('');
    const selectedUpdate = update.current;
    const result = await installAfterDocumentSave({
      acquire: acquireWorkspaceExit,
      prepare: () => flushSync(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }),
      save: saveActiveDocumentForExit,
      install: async () => {
        setPhase('installing');
        await selectedUpdate.install({ restartAfterInstall: true });
        if (/Mac/.test(navigator.platform)) await relaunch();
      },
    });
    if (result !== 'installing') {
      setPostponed(true);
      setPhase('downloaded');
      setError(result === 'blocked' ? 'Đang xử lý tài liệu nên chưa cài. Hãy chờ thao tác hoàn tất rồi thử lại.' : result === 'save-failed' ? 'Chưa lưu được tài liệu đang mở nên chưa cài. Hãy lưu tài liệu rồi thử lại.' : 'Chưa khởi chạy được bộ cài. Hãy thử lại.');
      busy.current = false;
    }
  };
  const autoUpdate = async () => {
    await checkUpdate(true);
    const failed = failedDownload.current;
    if (failed && failed.version === update.current?.version && Date.now() - failed.at < AUTO_RETRY_AFTER_FAILURE_MS) return;
    if (update.current && !ready.current) await download();
  };
  const dismiss = () => {
    if (phase === 'installing') return;
    autoRun.current += 1;
    if (phase === 'downloaded' || autoInFlight.current) setPostponed(true);
    setCountdown(null);
    setOpen(false);
  };
  const latestActions = useRef({ autoUpdate, install });
  useEffect(() => { latestActions.current = { autoUpdate, install }; });
  useEffect(() => {
    if (!isDesktop() || !automatic) return;
    const timer = setTimeout(() => void latestActions.current.autoUpdate(), FIRST_CHECK_MS);
    const interval = setInterval(() => void latestActions.current.autoUpdate(), AUTO_CHECK_MS);
    let lastFocusCheck = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFocusCheck < FOCUS_CHECK_MS) return;
      lastFocusCheck = Date.now();
      void latestActions.current.autoUpdate();
    };
    window.addEventListener('focus', onFocus);
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [automatic]);
  useEffect(() => {
    if (phase !== 'downloaded' || !automatic || editing || postponed) { setCountdown(null); return; }
    setOpen(true);
    setCountdown(INSTALL_COUNTDOWN_SECONDS);
  }, [phase, automatic, editing, postponed]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const run = ++autoRun.current;
      const start = () => {
        if (run !== autoRun.current) return true;
        if (busy.current) return false;
        setCountdown(null);
        void latestActions.current.install(run);
        return true;
      };
      if (start()) return;
      const wait = setInterval(() => { if (start()) clearInterval(wait); }, 500);
      return () => clearInterval(wait);
    }
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
  useEffect(() => { publishUpdaterStatus({ phase, version, nextVersion, percent }); }, [phase, version, nextVersion, percent]);
  if (!isDesktop()) return null;
  const working = ['checking', 'downloading', 'installing'].includes(phase);
  const ringMode: RingMode = phase === 'downloading' && percent === null ? 'spinning' : ringModes[phase];
  const title = ({ idle: 'Cập nhật Minh Spark Office', checking: 'Đang kiểm tra phiên bản', current: 'Đang dùng phiên bản mới nhất', available: `Đã có phiên bản ${nextVersion}`, downloading: 'Đang tải bản cập nhật', downloaded: `Bản ${nextVersion} đã sẵn sàng`, installing: 'Đang cài đặt bản cập nhật', error: 'Chưa kiểm tra được cập nhật' })[phase];
  return <>
    {open && <div className="sync-dialog-backdrop update-dialog-backdrop"><section className="sync-dialog update-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="update-title" onKeyDown={(event) => {
      if (event.key === 'Escape') dismiss();
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
      <label className="update-setting"><input type="checkbox" checked={automatic} disabled={working} onChange={(event) => { const value = event.target.checked; if (!value) autoRun.current += 1; setAutomatic(value); localStorage.setItem('office-auto-check', String(value)); }} />Tự động cập nhật để app luôn giống bản web</label>
      <div className="sync-dialog-actions">
        {phase !== 'installing' && <button className="btn" onClick={dismiss}>{phase === 'downloading' ? 'Tải trong nền' : 'Để sau'}</button>}
        {phase === 'available' && <button className="btn btn-primary" onClick={() => void download()}>Tải bản cập nhật</button>}
        {phase === 'downloaded' && <button className="btn btn-primary" onClick={() => { autoRun.current += 1; void install(); }}>{editing ? 'Lưu, cài đặt và mở lại' : 'Cài đặt và mở lại'}</button>}
        {['idle', 'current', 'error'].includes(phase) && <button className="btn btn-primary" onClick={() => void checkUpdate()}>Kiểm tra lại</button>}
      </div>
    </section></div>}
  </>;
}
