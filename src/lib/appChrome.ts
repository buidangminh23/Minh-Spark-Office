import { getSettings, subscribeSettings, type AppSettings } from './appSettings';
import { ACCENTS } from './appSettingsMeta';

const TITLE_ATTR = 'title';
const ORIGINAL_ATTR = 'data-title-original';
const APPLIED_ATTR = 'data-title-applied';
const SHORTCUT = /\s*\((?:Ctrl|Cmd|Alt|Shift|⌘|F\d)[^)]*\)\s*$/i;
const DESCRIPTION = /\s*[—–:]\s.+$/;

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function resolvedTheme(settings: AppSettings) {
  return settings.theme === 'system' ? (systemDark() ? 'dark' : 'light') : settings.theme;
}

export function tooltipFor(original: string, settings: Pick<AppSettings, 'tooltips' | 'tooltipShortcuts'>) {
  if (settings.tooltips === 'none') return '';
  let text = original;
  if (settings.tooltips === 'short') text = text.replace(DESCRIPTION, '');
  if (!settings.tooltipShortcuts) text = text.replace(SHORTCUT, '');
  return text.trim();
}

function rewriteTitle(element: Element, settings: AppSettings) {
  const title = element.getAttribute(TITLE_ATTR);
  const fresh = title !== null && title !== element.getAttribute(APPLIED_ATTR);
  const original = fresh ? title : element.getAttribute(ORIGINAL_ATTR);
  if (original === null) return;
  element.setAttribute(ORIGINAL_ATTR, original);
  const next = tooltipFor(original, settings);
  element.setAttribute(APPLIED_ATTR, next);
  if (next) {
    if (title !== next) element.setAttribute(TITLE_ATTR, next);
  } else if (title !== null) {
    element.removeAttribute(TITLE_ATTR);
  }
}

function tooltipsAreDefault(settings: AppSettings) {
  return settings.tooltips === 'full' && settings.tooltipShortcuts;
}

let observer: MutationObserver | null = null;

function syncTooltips(settings: AppSettings) {
  const root = document.body;
  if (!root) return;
  const restore = tooltipsAreDefault(settings);
  root.querySelectorAll(`[${TITLE_ATTR}], [${ORIGINAL_ATTR}]`).forEach((element) => rewriteTitle(element, settings));
  if (restore) {
    observer?.disconnect();
    observer = null;
    return;
  }
  if (observer) return;
  observer = new MutationObserver((records) => {
    const current = getSettings();
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof Element) {
        rewriteTitle(record.target, current);
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.hasAttribute(TITLE_ATTR)) rewriteTitle(node, current);
        node.querySelectorAll(`[${TITLE_ATTR}]`).forEach((element) => rewriteTitle(element, current));
      });
    }
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: [TITLE_ATTR] });
}

export function applyChromeSettings(settings = getSettings()) {
  const html = document.documentElement;
  const theme = resolvedTheme(settings);
  const accent = ACCENTS[settings.accent] ?? ACCENTS.blue;
  html.dataset.theme = theme;
  html.dataset.density = settings.density;
  html.style.colorScheme = theme;
  html.style.setProperty('--app-accent', accent.base);
  html.style.setProperty('--app-accent-hover', accent.hover);
  html.style.setProperty('--app-accent-soft', theme === 'dark' ? accent.darkSoft : accent.soft);
  html.toggleAttribute('data-reduce-motion', settings.reduceMotion);
  html.toggleAttribute('data-underline-links', settings.underlineLinks);
  html.toggleAttribute('data-strong-focus', settings.strongFocus);
  syncTooltips(settings);
}

export function startChromeSettings() {
  applyChromeSettings();
  subscribeSettings(() => applyChromeSettings());
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getSettings().theme === 'system') applyChromeSettings();
  });
}
