import { useSyncExternalStore } from 'react';
import { SHEET_DEFAULTS } from './settings/sheetDefaults';
import { SLIDE_DEFAULTS } from './settings/slideDefaults';

export type OfficeThemeId =
  | 'o16-colorful' | 'o16-white' | 'o16-darkgray' | 'o16-black'
  | 'o13-white' | 'o13-lightgray' | 'o13-darkgray'
  | 'o10-blue' | 'o10-silver' | 'o10-black'
  | 'o07-blue' | 'o07-silver' | 'o07-black';
export type ThemeMode = 'light' | 'dark' | 'system' | 'custom' | OfficeThemeId;
export type Density = 'comfortable' | 'normal' | 'compact';
export type TooltipMode = 'full' | 'short' | 'none';
export type StartupMode = 'home' | 'lastDocument' | 'newDoc';
export type PasteMode = 'keep' | 'merge' | 'text';
export type MacroPolicy = 'disable' | 'ask' | 'enable';
export type ProofLanguage = 'vi' | 'en-US';
export type HomeApp = 'doc' | 'sheet' | 'slide' | 'pdf' | 'image';
export type DocTab = 'home' | 'insert' | 'draw' | 'design' | 'layout' | 'references' | 'mailings' | 'review' | 'view' | 'help';
export type QatCommand = 'undo' | 'redo' | 'print' | 'pdf' | 'find' | 'newDoc' | 'spelling' | 'readAloud' | 'comment' | 'table' | 'picture' | 'save';
export type QatPosition = 'above' | 'below';

export const DEFAULT_SETTINGS = {
  theme: 'light' as ThemeMode,
  customHue: 215,
  customSat: 62,
  customLight: 42,
  customTint: 8,
  density: 'normal' as Density,
  miniToolbar: true,
  collapseRibbon: false,
  tooltips: 'full' as TooltipMode,
  tooltipShortcuts: true,
  userName: '',
  initials: '',
  alwaysUseName: false,
  startup: 'home' as StartupMode,
  recentCount: 5,
  homeApps: { doc: true, sheet: true, slide: true, pdf: true, image: true } as Record<HomeApp, boolean>,

  docPageGap: true,
  docHighlight: true,
  docRuler: true,
  docNavPane: true,
  docZoom: 100,
  markTabs: false,
  markSpaces: false,
  markParagraphs: false,
  markBreaks: false,
  markAll: false,
  printDrawings: true,
  printBackground: true,
  printProperties: false,
  printComments: false,

  acEnabled: true,
  acCapitalize: true,
  acSymbols: true,
  acMath: true,
  acSuperscript: true,
  acSmartQuotes: false,
  acCustomList: true,
  spellcheck: true,
  proofLanguage: 'vi' as ProofLanguage,

  pasteOther: 'keep' as PasteMode,
  pasteSame: 'keep' as PasteMode,

  reduceMotion: false,
  underlineLinks: false,
  strongFocus: false,

  docTabs: { home: true, insert: true, draw: true, design: true, layout: true, references: true, mailings: true, review: true, view: true, help: true } as Record<DocTab, boolean>,
  qatShow: true,
  qatPosition: 'above' as QatPosition,
  qatCommands: ['save', 'undo', 'redo'] as QatCommand[],

  addinClaude: true,
  addinChatgpt: true,

  macroPolicy: 'ask' as MacroPolicy,
  confirmLinks: true,
  usageStats: true,
  ...SHEET_DEFAULTS,
  ...SLIDE_DEFAULTS,
};

export type AppSettings = typeof DEFAULT_SETTINGS;

const STORAGE_KEY = 'minh-office-settings';
const listeners = new Set<() => void>();
let cache: AppSettings | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function mergeStored(raw: Record<string, unknown>): AppSettings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (Array.isArray(fallback)) merged[key] = Array.isArray(value) ? value : fallback;
    else if (isRecord(fallback)) merged[key] = isRecord(value) ? { ...fallback, ...value } : fallback;
    else if (typeof value === typeof fallback) merged[key] = value;
  }
  return merged as AppSettings;
}

function read(): AppSettings {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return mergeStored(isRecord(raw) ? raw : {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSettings(): AppSettings {
  if (!cache) cache = read();
  return cache;
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function setSettings(patch: Partial<AppSettings>) {
  cache = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable: the change still applies for this session */
  }
  emit();
}

export function resetSettings(keys?: (keyof AppSettings)[]) {
  if (!keys) {
    cache = { ...DEFAULT_SETTINGS };
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    emit();
    return;
  }
  setSettings(Object.fromEntries(keys.map((key) => [key, DEFAULT_SETTINGS[key]])) as Partial<AppSettings>);
}

export function subscribeSettings(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    cache = read();
    emit();
  });
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export function useSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return useSyncExternalStore(subscribeSettings, () => getSettings()[key], () => getSettings()[key]);
}
