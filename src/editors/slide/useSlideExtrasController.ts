import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PresentationData, SlideAspect, SlideElement } from '../../lib/slideTypes';
import { resolveTheme } from '../../lib/slideThemeOps';
import { changeCase, extractFormat, formatPatchFor, type ElementFormat, type TextCase } from '../../lib/slideTextOps';
import { isEditableKeyTarget } from './slideKeyTarget';
import { imageAspect } from '../../lib/slideImageOps';
import { slideBaseWidth } from '../../lib/settings/slideOptions';
import { imageEl } from './ribbonInsert';
import { newElementId, type ColorView, type FormatPainterMode, type PasteMode, type ShowLaunch, type SlideDialog, type SlideExtrasApi, type SlidePane, type ViewModeExtra } from './slideExtrasContext';

export interface ExtrasDeps {
  presentation: PresentationData;
  getPresentation: () => PresentationData;
  setPresentation: (updater: (current: PresentationData) => PresentationData) => void;
  pushHistory: (snapshot: PresentationData) => void;
  activeSlideIndex: number;
  setActiveSlideIndex: (index: number) => void;
  selectedIds: string[];
  primaryId: string | null;
  selectElements: (ids: string[], primary: string | null) => void;
  toast: (text: string, error?: boolean) => void;
  cut: () => void;
  copy: () => void;
  pasteInternal: () => void;
  hasInternalClipboard: boolean;
  setEditorViewMode: (mode: 'normal' | 'sorter') => void;
  startShow: (launch: ShowLaunch) => void;
}

const SLIDE_HEIGHT = 540;
const SPEECH_LANG_FALLBACK = 'vi-VN';
const PASTE_OFFSET = 4;
const FONT_STEP = 2;
const MIN_FONT = 8;
const MAX_FONT = 200;
const CASE_CYCLE: TextCase[] = ['upper', 'lower', 'sentence'];
const ALIGN_KEYS: Record<string, SlideElement['textAlign']> = { e: 'center', l: 'left', r: 'right', j: 'justify' };

type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechCtor(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function textBox(text: string, presentation: PresentationData): SlideElement {
  const theme = resolveTheme(presentation);
  return { id: newElementId('paste'), type: 'text', x: 15, y: 30, width: 70, height: 30, text, fontSize: 20, fontFamily: theme.bodyFont, color: theme.textColor, zIndex: 50 };
}

async function readClipboardImage(): Promise<string | null> {
  if (!navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (!type) continue;
    const blob = await item.getType(type);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  return null;
}

export function useSlideExtrasController(deps: ExtrasDeps) {
  const { presentation, activeSlideIndex, selectedIds, primaryId } = deps;
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [dialog, setDialog] = useState<SlideDialog | null>(null);
  const [pane, setPane] = useState<SlidePane | null>(null);
  const [viewMode, setViewModeState] = useState<ViewModeExtra>('normal');
  const [colorView, setColorView] = useState<ColorView>('color');
  const [hideInk, setHideInk] = useState(false);
  const [formatPainter, setFormatPainter] = useState<FormatPainterMode>('off');
  const painterFormat = useRef<ElementFormat | null>(null);
  const [dictating, setDictating] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const windowsRef = useRef<Window[]>([]);

  const currentSlide = presentation.slides[activeSlideIndex] ?? presentation.slides[0];
  const theme = useMemo(() => resolveTheme(presentation), [presentation]);
  const selectedElements = useMemo(() => currentSlide.elements.filter((el) => selectedIds.includes(el.id)), [currentSlide, selectedIds]);
  const selectedElement = selectedElements.find((el) => el.id === primaryId) ?? selectedElements[0] ?? null;

  const commit = useCallback((updater: (current: PresentationData) => PresentationData) => {
    const d = depsRef.current;
    d.pushHistory(d.getPresentation());
    d.setPresentation(updater);
  }, []);

  const mapSlideElements = useCallback((fn: (el: SlideElement) => SlideElement) => {
    const index = depsRef.current.activeSlideIndex;
    commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === index ? { ...s, elements: s.elements.map(fn) } : s)) }));
  }, [commit]);

  const updateElement = useCallback((id: string, patch: Partial<SlideElement>) => {
    mapSlideElements((el) => (el.id === id ? { ...el, ...patch } : el));
  }, [mapSlideElements]);

  const updateSelected = useCallback((patch: Partial<SlideElement> | ((el: SlideElement) => Partial<SlideElement>)) => {
    const ids = depsRef.current.selectedIds;
    if (ids.length === 0) return;
    mapSlideElements((el) => (ids.includes(el.id) ? { ...el, ...(typeof patch === 'function' ? patch(el) : patch) } : el));
  }, [mapSlideElements]);

  const addElements = useCallback((els: SlideElement[]) => {
    if (els.length === 0) return;
    const index = depsRef.current.activeSlideIndex;
    commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === index ? { ...s, elements: [...s.elements, ...els] } : s)) }));
    depsRef.current.selectElements(els.map((el) => el.id), els[els.length - 1].id);
  }, [commit]);

  const addElement = useCallback((el: SlideElement) => addElements([el]), [addElements]);

  const paste = useCallback(async (mode: PasteMode) => {
    const d = depsRef.current;
    if (mode === 'keep' || mode === 'destination') {
      if (d.hasInternalClipboard) {
        d.pasteInternal();
        if (mode === 'destination') {
          window.setTimeout(() => {
            const t = resolveTheme(d.getPresentation());
            updateSelected((el) => (el.type === 'text' || el.type === 'shape' ? { fontFamily: t.bodyFont, color: el.type === 'text' ? t.textColor : el.color } : {}));
          }, 0);
        }
        return;
      }
    }
    try {
      const image = mode === 'text' ? null : await readClipboardImage();
      if (image) {
        const ratio = await imageAspect(image);
        const p = d.getPresentation();
        addElement(imageEl(image, ratio, slideBaseWidth(p.aspectRatio) / SLIDE_HEIGHT, 'Ảnh dán'));
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        d.toast('Bộ nhớ tạm đang trống');
        return;
      }
      const el = textBox(text, d.getPresentation());
      addElement(mode === 'picture' ? { ...el, name: 'Văn bản dạng ảnh', locked: true, x: el.x + PASTE_OFFSET } : el);
    } catch {
      d.toast('Trình duyệt chưa cho đọc bộ nhớ tạm. Hãy dùng Ctrl+V.', true);
    }
  }, [addElement, updateSelected]);

  const startFormatPainter = useCallback((sticky: boolean) => {
    const el = selectedElements[0];
    if (!el) {
      depsRef.current.toast('Hãy chọn đối tượng có định dạng cần sao chép trước');
      return;
    }
    painterFormat.current = extractFormat(el);
    setFormatPainter(sticky ? 'sticky' : 'once');
    depsRef.current.toast(sticky ? 'Sao định dạng liên tục: bấm vào các đối tượng, nhấn Esc để thôi' : 'Bấm vào đối tượng cần dán định dạng');
  }, [selectedElements]);

  const interceptSelect = useCallback((elId: string | null) => {
    if (formatPainter === 'off' || !elId || !painterFormat.current) return false;
    const format = painterFormat.current;
    mapSlideElements((el) => (el.id === elId ? { ...el, ...formatPatchFor(el, format) } : el));
    if (formatPainter === 'once') {
      setFormatPainter('off');
      painterFormat.current = null;
    }
    return true;
  }, [formatPainter, mapSlideElements]);

  useEffect(() => {
    if (formatPainter === 'off') return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFormatPainter('off');
        painterFormat.current = null;
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [formatPainter]);

  const togglePane = useCallback((next: SlidePane) => setPane((current) => (current === next ? null : next)), []);

  const setViewMode = useCallback((mode: ViewModeExtra) => {
    const d = depsRef.current;
    if (mode === 'reading') {
      d.startShow({ fromCurrent: true, windowed: true });
      return;
    }
    setViewModeState(mode);
    d.setEditorViewMode(mode === 'sorter' ? 'sorter' : 'normal');
  }, []);

  const toggleDictation = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setDictating(false);
      return;
    }
    const Ctor = speechCtor();
    const d = depsRef.current;
    if (!Ctor) {
      d.toast('Trình duyệt này chưa hỗ trợ đọc chính tả', true);
      return;
    }
    if (d.selectedIds.length === 0) {
      d.toast('Hãy chọn ô văn bản cần nhập trước');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = d.getPresentation().language || SPEECH_LANG_FALLBACK;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let heard = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) heard += event.results[i][0].transcript;
      }
      if (heard.trim()) updateSelected((el) => ({ text: `${el.text ?? ''}${el.text ? ' ' : ''}${heard.trim()}` }));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setDictating(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setDictating(true);
  }, [updateSelected]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const openNewWindow = useCallback(() => {
    const opened = window.open(window.location.href, '_blank', 'popup,width=1100,height=760');
    if (!opened) {
      depsRef.current.toast('Trình duyệt đã chặn cửa sổ mới', true);
      return;
    }
    windowsRef.current = [...windowsRef.current.filter((w) => !w.closed), opened];
  }, []);

  const arrangeWindows = useCallback((mode: 'tile' | 'cascade') => {
    const open = windowsRef.current.filter((w) => !w.closed);
    if (open.length === 0) {
      depsRef.current.toast('Chưa có cửa sổ mới nào. Bấm Cửa sổ mới trước.');
      return;
    }
    const all = open.length + 1;
    const width = Math.floor(window.screen.availWidth / (mode === 'tile' ? all : 1.4));
    const height = window.screen.availHeight;
    open.forEach((w, i) => {
      try {
        w.moveTo(mode === 'tile' ? width * (i + 1) : 40 * (i + 1), mode === 'tile' ? 0 : 40 * (i + 1));
        w.resizeTo(width, mode === 'tile' ? height : Math.floor(height * 0.8));
      } catch {
        // Some browsers ignore programmatic window placement.
      }
    });
  }, []);

  const focusSplit = useCallback(() => {
    document.querySelector<HTMLElement>('.ppt-thumbnails, .ppx-outline')?.focus();
    depsRef.current.toast('Dùng Tab để chuyển giữa ngăn trang chiếu, trang soạn và ghi chú');
  }, []);

  const caseStep = useRef(0);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableKeyTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const run = (action: () => void) => {
        event.preventDefault();
        action();
      };
      if (ctrl && event.shiftKey && key === 'c') run(() => {
        const el = selectedElements[0];
        if (el) {
          painterFormat.current = extractFormat(el);
          depsRef.current.toast('Đã sao chép định dạng (Ctrl+Shift+V để dán)');
        }
      });
      else if (ctrl && event.shiftKey && key === 'v') run(() => {
        const format = painterFormat.current;
        if (format) updateSelected((el) => formatPatchFor(el, format));
      });
      else if (ctrl && event.shiftKey && key === 'f') run(() => setDialog('font'));
      else if (ctrl && event.altKey && key === 'm') run(() => setPane('comments'));
      else if (ctrl && !event.shiftKey && key === 'k') run(() => setDialog('link'));
      else if (ctrl && !event.shiftKey && ALIGN_KEYS[key] && depsRef.current.selectedIds.length > 0) run(() => updateSelected({ textAlign: ALIGN_KEYS[key] }));
      else if (ctrl && (key === ']' || key === '[' || (event.shiftKey && (key === '>' || key === '<' || key === '.' || key === ',')))) run(() => {
        const up = key === ']' || key === '>' || key === '.';
        updateSelected((el) => ({ fontSize: Math.max(MIN_FONT, Math.min(MAX_FONT, (el.fontSize ?? 18) + (up ? FONT_STEP : -FONT_STEP))) }));
      });
      else if (event.shiftKey && event.key === 'F3') run(() => {
        const mode = CASE_CYCLE[caseStep.current % CASE_CYCLE.length];
        caseStep.current += 1;
        updateSelected((el) => (el.text ? { text: changeCase(el.text, mode) } : {}));
      });
      else if (event.shiftKey && event.key === 'F7') run(() => setDialog('thesaurus'));
      else if (event.key === 'F7' && !event.shiftKey) run(() => setPane('accessibility'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedElements, updateSelected]);

  const changeAspect = useCallback((aspect: SlideAspect) => commit((p) => ({ ...p, aspectRatio: aspect })), [commit]);

  const api: SlideExtrasApi = {
    presentation,
    theme,
    currentSlide,
    activeSlideIndex,
    selectedElement,
    selectedElements,
    toast: deps.toast,
    updateSelected,
    updateElement,
    addElement,
    addElements,
    commit,
    selectElements: (ids, primary) => deps.selectElements(ids, primary ?? null),
    goToSlide: deps.setActiveSlideIndex,
    cut: deps.cut,
    copy: deps.copy,
    paste,
    canPaste: true,
    formatPainter,
    startFormatPainter,
    openDialog: setDialog,
    pane,
    togglePane,
    viewMode,
    setViewMode,
    colorView,
    setColorView,
    hideInk,
    setHideInk,
    launchShow: deps.startShow,
    dictating,
    toggleDictation,
    openNewWindow,
    arrangeWindows,
    focusSplit,
  };

  return { api, dialog, closeDialog: () => setDialog(null), pane, closePane: () => setPane(null), interceptSelect, changeAspect };
}
