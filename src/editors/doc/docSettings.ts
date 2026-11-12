import { useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import { getSettings, setSettings, useSettings, type AppSettings, type PasteMode } from '../../lib/appSettings';
import { resolvedTheme } from '../../lib/appChrome';
import type { ViewState } from './DocContext';
import type { AutoCorrectFlags } from './extensionsExtra';

const INTERNAL_SLICE = /data-pm-slice=/;
const STYLE_ATTRS = /\s(?:style|class|face|color|size|bgcolor|lang)="[^"]*"/gi;
const FONT_TAGS = /<\/?(?:font|span)(?:\s[^>]*)?>/gi;

export function viewFromSettings(saved: Pick<ViewState, 'ribbonCollapsed'>, settings = getSettings()): Partial<ViewState> {
  return {
    showRuler: settings.docRuler,
    showNav: settings.docNavPane,
    zoom: settings.docZoom,
    spellcheck: settings.spellcheck,
    ribbonCollapsed: settings.collapseRibbon || saved.ribbonCollapsed,
    dark: resolvedTheme(settings) === 'dark',
    showMarks: settings.markAll,
  };
}

export function rememberView(view: Pick<ViewState, 'showRuler' | 'showNav' | 'spellcheck'>) {
  const current = getSettings();
  const patch: Partial<AppSettings> = {};
  if (current.docRuler !== view.showRuler) patch.docRuler = view.showRuler;
  if (current.docNavPane !== view.showNav) patch.docNavPane = view.showNav;
  if (current.spellcheck !== view.spellcheck) patch.spellcheck = view.spellcheck;
  if (Object.keys(patch).length) setSettings(patch);
}

export function pasteModeFor(html: string, settings = getSettings()): PasteMode {
  return INTERNAL_SLICE.test(html) ? settings.pasteSame : settings.pasteOther;
}

export function mergeFormatting(html: string) {
  return html.replace(STYLE_ATTRS, '').replace(FONT_TAGS, '');
}

export function handleConfiguredPaste(editor: Editor, event: ClipboardEvent) {
  const data = event.clipboardData;
  const html = data?.getData('text/html') ?? '';
  if (!data || !html) return false;
  const mode = pasteModeFor(html);
  if (mode === 'keep') return false;
  event.preventDefault();
  if (mode === 'text') {
    const text = data.getData('text/plain');
    editor.chain().focus().insertContent(text.split(/\r?\n/).map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }))).run();
    return true;
  }
  editor.chain().focus().insertContent(mergeFormatting(html)).run();
  return true;
}

export function shellClasses(settings: AppSettings) {
  return [
    settings.markAll || settings.markParagraphs ? 'mark-paras' : '',
    settings.docHighlight ? '' : 'no-highlight',
    settings.printDrawings ? '' : 'print-no-ink',
    settings.printBackground ? 'print-bg' : '',
    settings.miniToolbar ? '' : 'no-mini-toolbar',
  ].filter(Boolean).join(' ');
}

export function useDocEditorSettings(editor: Editor, pageAutocorrect: boolean | undefined, setView: (patch: Partial<ViewState>) => void) {
  const settings = useSettings();
  const theme = resolvedTheme(settings);

  useEffect(() => {
    const storage = editor.storage as unknown as { autoCorrect?: AutoCorrectFlags };
    if (!storage.autoCorrect) return;
    Object.assign(storage.autoCorrect, {
      enabled: settings.acEnabled && pageAutocorrect !== false,
      capitalize: settings.acCapitalize,
      symbols: settings.acSymbols,
      math: settings.acMath,
      superscript: settings.acSuperscript,
      smartQuotes: settings.acSmartQuotes,
      customList: settings.acCustomList,
    });
  }, [editor, pageAutocorrect, settings.acEnabled, settings.acCapitalize, settings.acSymbols, settings.acMath, settings.acSuperscript, settings.acSmartQuotes, settings.acCustomList]);

  useEffect(() => {
    editor.view.dom.setAttribute('lang', settings.proofLanguage);
  }, [editor, settings.proofLanguage]);

  useEffect(() => {
    if (editor.isDestroyed) return;
    editor.commands.setFormattingMarks({
      spaces: settings.markAll || settings.markSpaces,
      tabs: settings.markAll || settings.markTabs,
      breaks: settings.markAll || settings.markBreaks,
    });
  }, [editor, settings.markAll, settings.markSpaces, settings.markTabs, settings.markBreaks]);

  useEffect(() => {
    setView({ dark: theme === 'dark' });
  }, [theme, setView]);

  useEffect(() => {
    setView({ showRuler: settings.docRuler, showNav: settings.docNavPane, spellcheck: settings.spellcheck });
  }, [settings.docRuler, settings.docNavPane, settings.spellcheck, setView]);

  useEffect(() => {
    if (settings.markAll) setView({ showMarks: true });
  }, [settings.markAll, setView]);

  return settings;
}
