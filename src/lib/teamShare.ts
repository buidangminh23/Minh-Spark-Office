import { tabHost } from './documentTabs';

export const SHARE_FILE_EVENT = 'minh-office:share-file';
const SAVE_BEFORE_SHARE_MS = 8_000;

export type ShareFileRequest = { fileId: string; kind: string };

export function isShareableFileId(fileId: string) {
  return Boolean(fileId) && !fileId.startsWith('team.');
}

export function announceShareFile(request: ShareFileRequest, target: Window = window) {
  target.dispatchEvent(new CustomEvent<ShareFileRequest>(SHARE_FILE_EVENT, { detail: request }));
}

export function requestTeamShare(request: ShareFileRequest) {
  const host = tabHost();
  if (host?.command({ type: 'shareFile', fileId: request.fileId, kind: request.kind })) return true;
  announceShareFile(request);
  return false;
}

export function settleWithin<T>(promise: Promise<T> | undefined, fallback: T, ms = SAVE_BEFORE_SHARE_MS) {
  if (!promise) return Promise.resolve(fallback);
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

export function onShareFile(listener: (request: ShareFileRequest) => void, target: Window = window) {
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<ShareFileRequest>).detail;
    if (detail && typeof detail.fileId === 'string' && isShareableFileId(detail.fileId)) listener(detail);
  };
  target.addEventListener(SHARE_FILE_EVENT, handle);
  return () => target.removeEventListener(SHARE_FILE_EVENT, handle);
}
