import { createContext, useContext } from 'react';
import type { PresentationData, SlideData, SlideElement, SlideTheme } from '../../lib/slideTypes';

export type SlideDialog =
  | 'font'
  | 'paragraph'
  | 'replace-fonts'
  | 'insert-table'
  | 'link'
  | 'header-footer'
  | 'date-time'
  | 'symbol'
  | 'icons'
  | 'object'
  | 'slide-size'
  | 'setup-show'
  | 'record-studio'
  | 'export-video'
  | 'language'
  | 'thesaurus'
  | 'translate'
  | 'handout-master'
  | 'notes-master'
  | 'macros'
  | 'alt-text'
  | 'crop'
  | 'size-position'
  | 'section-rename'
  | 'compress'
  | 'monitor'
  | 'subtitles'
  | 'record-audio'
  | 'screen-record'
  | 'insert-symbol-text';

export type SlidePane = 'selection' | 'comments' | 'accessibility';

export type ViewModeExtra = 'normal' | 'sorter' | 'outline' | 'notes' | 'reading';

export type ColorView = 'color' | 'grayscale' | 'black-white';

export type FormatPainterMode = 'off' | 'once' | 'sticky';

export type PasteMode = 'keep' | 'text' | 'picture' | 'destination';

export interface ShowLaunch {
  fromCurrent: boolean;
  rehearse?: boolean;
  coach?: boolean;
  recording?: boolean;
  exportVideo?: boolean;
  windowed?: boolean;
  presenter?: boolean;
}

export interface SlideExtrasApi {
  presentation: PresentationData;
  theme: SlideTheme;
  currentSlide: SlideData;
  activeSlideIndex: number;
  selectedElement: SlideElement | null;
  selectedElements: SlideElement[];
  toast: (text: string, error?: boolean) => void;
  updateSelected: (patch: Partial<SlideElement> | ((el: SlideElement) => Partial<SlideElement>)) => void;
  updateElement: (id: string, patch: Partial<SlideElement>) => void;
  addElement: (el: SlideElement) => void;
  addElements: (els: SlideElement[]) => void;
  commit: (updater: (current: PresentationData) => PresentationData) => void;
  selectElements: (ids: string[], primary?: string | null) => void;
  goToSlide: (index: number) => void;
  cut: () => void;
  copy: () => void;
  paste: (mode: PasteMode) => Promise<void>;
  canPaste: boolean;
  formatPainter: FormatPainterMode;
  startFormatPainter: (sticky: boolean) => void;
  openDialog: (dialog: SlideDialog) => void;
  pane: SlidePane | null;
  togglePane: (pane: SlidePane) => void;
  viewMode: ViewModeExtra;
  setViewMode: (mode: ViewModeExtra) => void;
  colorView: ColorView;
  setColorView: (mode: ColorView) => void;
  hideInk: boolean;
  setHideInk: (hidden: boolean) => void;
  launchShow: (launch: ShowLaunch) => void;
  dictating: boolean;
  toggleDictation: () => void;
  openNewWindow: () => void;
  arrangeWindows: (mode: 'tile' | 'cascade') => void;
  focusSplit: () => void;
}

export const SlideExtrasContext = createContext<SlideExtrasApi | null>(null);

export function useSlideExtras(): SlideExtrasApi {
  const value = useContext(SlideExtrasContext);
  if (!value) throw new Error('SlideExtrasContext missing');
  return value;
}

export const newElementId = (prefix: string) => `el-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
