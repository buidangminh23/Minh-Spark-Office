import { invoke } from '@tauri-apps/api/core';

export function isDesktop() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function openWebApp() {
  await invoke<void>('open_web_app');
}
