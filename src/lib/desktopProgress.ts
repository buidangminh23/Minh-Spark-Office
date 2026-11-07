import { getCurrentWindow, ProgressBarStatus, UserAttentionType } from '@tauri-apps/api/window';
import { isDesktop } from './desktop';

let shownPercent: number | null = null;

export function showDockProgress(percent: number) {
  if (!isDesktop()) return;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  if (value === shownPercent) return;
  shownPercent = value;
  void getCurrentWindow().setProgressBar({ status: ProgressBarStatus.Normal, progress: value }).catch(() => undefined);
}

export function clearDockProgress() {
  if (!isDesktop() || shownPercent === null) return;
  shownPercent = null;
  void getCurrentWindow().setProgressBar({ status: ProgressBarStatus.None }).catch(() => undefined);
}

export function requestDockAttention() {
  if (!isDesktop() || document.hasFocus()) return;
  void getCurrentWindow().requestUserAttention(UserAttentionType.Informational).catch(() => undefined);
}
