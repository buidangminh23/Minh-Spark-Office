import { useEffect, useState } from 'react';
import { isDesktop } from '../lib/desktop';
import { WEB_UPDATE_INTERVAL_MS, fetchLiveBuild, isNewerBuild } from '../lib/webUpdate';

declare const __APP_BUILD__: string;

export function WebUpdateNotice({ editing }: { editing: boolean }) {
  const [nextVersion, setNextVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (isDesktop() || import.meta.env.DEV) return;
    let active = true;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const live = await fetchLiveBuild();
      if (active && isNewerBuild(__APP_BUILD__, live)) setNextVersion(live?.version ?? '');
    };
    const timer = window.setInterval(() => void check(), WEB_UPDATE_INTERVAL_MS);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);
  if (nextVersion === null || dismissed) return null;
  return <div className="web-update-notice" role="status" aria-live="polite">
    <span>{nextVersion ? `Đã có Office 23 bản ${nextVersion}.` : 'Đã có bản Office 23 mới.'} {editing ? 'Lưu tài liệu rồi tải lại trang để dùng bản mới.' : 'Tải lại trang để dùng bản mới.'}</span>
    <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Tải lại</button>
    <button type="button" className="btn" onClick={() => setDismissed(true)}>Để sau</button>
  </div>;
}
