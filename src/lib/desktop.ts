import { invoke } from '@tauri-apps/api/core';

export function isDesktop() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isMobileApp() {
  return isDesktop() && /Android|iPhone|iPad/i.test(navigator.userAgent);
}

export function isInstalledApp() {
  if (isDesktop()) return true;
  if (typeof window === 'undefined') return false;
  const standalone = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches);
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function openWebApp() {
  await invoke<void>('open_web_app');
}

export async function openDesktopSignIn(publicKey: string) {
  try {
    await invoke<void>('desktop_google_sign_in', { publicKey });
  } catch (error) {
    throw new Error(typeof error === 'string' ? error : 'auth/desktop-browser');
  }
}

export async function focusDesktopWindow() {
  await invoke<void>('desktop_sign_in_received').catch(() => undefined);
}
