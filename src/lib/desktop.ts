import { invoke } from '@tauri-apps/api/core';

export function isDesktop() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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
