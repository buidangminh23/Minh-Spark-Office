import { invoke } from '@tauri-apps/api/core';

export function isDesktop() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function openWebApp() {
  await invoke<void>('open_web_app');
}

export async function desktopGoogleToken() {
  try {
    return await invoke<string>('desktop_google_sign_in');
  } catch (error) {
    throw new Error(typeof error === 'string' ? error : 'auth/desktop-failed');
  }
}

export async function cancelDesktopSignIn() {
  await invoke<void>('cancel_desktop_sign_in');
}
