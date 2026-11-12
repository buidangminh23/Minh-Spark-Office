import { installTabShortcuts } from './documentTabs';

const SHARED_GLOBALS = ['__TAURI_INTERNALS__', '__TAURI_EVENT_PLUGIN_INTERNALS__', '__TAURI_OS_PLUGIN_INTERNALS__', '__TAURI__'] as const;

export function shareParentDesktopBridge(frame: Window = window) {
  if (frame.parent === frame) return;
  try {
    const parent = frame.parent as unknown as Record<string, unknown>;
    const own = frame as unknown as Record<string, unknown>;
    for (const name of SHARED_GLOBALS) {
      if (name in own || !(name in parent)) continue;
      Object.defineProperty(own, name, { value: parent[name], configurable: true });
    }
  } catch {
    return;
  }
}

shareParentDesktopBridge();
installTabShortcuts();
