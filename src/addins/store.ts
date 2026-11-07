import { useSyncExternalStore } from 'react';
import type { AddinProvider } from '../../api/_shared/addin';

let current: AddinProvider | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function toggleAddin(provider: AddinProvider) {
  current = current === provider ? null : provider;
  emit();
}

export const getOpenAddin = () => current;

export function closeAddin() {
  if (current === null) return;
  current = null;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useOpenAddin = () => useSyncExternalStore(subscribe, () => current, () => null);

export const ADDIN_INFO: Record<AddinProvider, { name: string; logo: string; color: string; keyLabel: string; keyHint: string; keyUrl: string }> = {
  claude: { name: 'Claude', logo: '/addins/claude.svg', color: '#d97757', keyLabel: 'API key Anthropic', keyHint: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys' },
  chatgpt: { name: 'ChatGPT', logo: '/addins/openai.svg', color: '#10a37f', keyLabel: 'API key OpenAI', keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys' },
};
