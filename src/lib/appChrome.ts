import { getSettings, subscribeSettings, type AppSettings } from './appSettings';
import { chromeFamily, chromeStyleSheet, customColorOf, hslString, themeVars } from './chromeThemes';

const TITLE_ATTR = 'title';
const ORIGINAL_ATTR = 'data-title-original';
const APPLIED_ATTR = 'data-title-applied';
const SHORTCUT = /\s*\((?:Ctrl|Cmd|Alt|Shift|⌘|F\d)[^)]*\)\s*$/i;
const DESCRIPTION = /\s*[—–:]\s.+$/;

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function resolvedTheme(settings: AppSettings): 'light' | 'dark' {
  if (settings.theme === 'system') return systemDark() ? 'dark' : 'light';
  return settings.theme === 'dark' ? 'dark' : 'light';
}

const CHROME_STYLE_ID = 'office-chrome-vars';
const DEFAULT_ACCENT = '#2563eb';

function applyOfficeChrome(html: HTMLElement, settings: AppSettings) {
  const vars = themeVars(settings.theme, settings);
  let style = document.getElementById(CHROME_STYLE_ID);
  if (!vars) {
    delete html.dataset.office;
    delete html.dataset.officeFamily;
    style?.remove();
    return;
  }
  html.dataset.office = settings.theme;
  html.dataset.officeFamily = chromeFamily(settings.theme);
  if (!style) {
    style = document.createElement('style');
    style.id = CHROME_STYLE_ID;
    document.head.appendChild(style);
  }
  const css = chromeStyleSheet(vars);
  if (style.textContent !== css) style.textContent = css;
}

function accentColor(settings: AppSettings) {
  if (settings.theme !== 'custom') return DEFAULT_ACCENT;
  const color = customColorOf(settings);
  return hslString(color.hue, color.sat, color.light);
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
  const accent = accentColor(settings);
  html.dataset.theme = theme;
  html.dataset.density = settings.density;
  html.style.colorScheme = theme;
  html.style.setProperty('--app-accent', accent);
  html.style.setProperty('--app-accent-hover', `color-mix(in srgb, ${accent} 84%, black)`);
  html.style.setProperty('--app-accent-soft', `color-mix(in srgb, ${accent} ${theme === 'dark' ? 24 : 10}%, ${theme === 'dark' ? '#161c28' : 'white'})`);
  applyOfficeChrome(html, settings);
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
