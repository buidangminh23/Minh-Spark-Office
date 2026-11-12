import { useSyncExternalStore } from 'react';

export type UpdaterPhase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
export type UpdaterStatus = { phase: UpdaterPhase; version: string; nextVersion: string; percent: number | null };

let status: UpdaterStatus = { phase: 'idle', version: '', nextVersion: '', percent: null };
const listeners = new Set<() => void>();

export function publishUpdaterStatus(next: UpdaterStatus) {
  if (next.phase === status.phase && next.version === status.version && next.nextVersion === status.nextVersion && next.percent === status.percent) return;
  status = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useUpdaterStatus = () => useSyncExternalStore(subscribe, () => status, () => status);

export const updateNeedsAttention = (phase: UpdaterPhase) => phase === 'available' || phase === 'downloaded';

export function updaterLabel({ phase, nextVersion, percent }: UpdaterStatus) {
  switch (phase) {
    case 'checking': return 'Đang kiểm tra phiên bản…';
    case 'current': return 'Đang dùng phiên bản mới nhất';
    case 'available': return `Đã có phiên bản ${nextVersion}`;
    case 'downloading': return percent === null ? 'Đang tải bản mới…' : `Đang tải bản mới ${percent}%`;
    case 'downloaded': return `Bản ${nextVersion} đã tải xong, sẵn sàng cài`;
    case 'installing': return 'Đang cài đặt bản cập nhật';
    case 'error': return 'Chưa kiểm tra được cập nhật';
    default: return 'Chưa kiểm tra lần nào trong phiên này';
  }
}
