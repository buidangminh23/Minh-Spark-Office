export type SlideRibbonTabId = 'home' | 'insert' | 'draw' | 'design' | 'transitions' | 'animations' | 'slideshow' | 'record' | 'review' | 'view';
export type SlideQatCommand = 'save' | 'undo' | 'redo' | 'present' | 'presentCurrent' | 'newSlide' | 'textBox' | 'find' | 'print' | 'pptx' | 'notes';
export type SlideQatPosition = 'above' | 'below';
export type SlideOpenView = 'normal' | 'sorter';
export type SlideAspectRatio = import('../slideTypes').SlideAspect;
export type SlideLaserColor = 'red' | 'green' | 'blue';
export type SlidePenColor = 'red' | 'blue' | 'green' | 'black' | 'yellow';

export const SLIDE_DEFAULTS = {
  slideRuler: true,
  slideGridlines: false,
  slideGuides: false,
  slideNotes: true,
  slideGridSize: 20,
  slideSnapToGrid: false,
  slideSmartGuides: true,
  slideOpenView: 'normal' as SlideOpenView,
  slideZoom: 0,

  slideTextFont: '',
  slideTextSize: 24,
  slideSpellcheck: true,
  slideMaxUndo: 26,

  slideNewAspect: '16:9' as SlideAspectRatio,
  slideNewTheme: 'office-classic',

  slideShowToolbar: true,
  slideRightClickMenu: false,
  slidePresenterView: false,
  slideEndWithBlack: false,
  slideLoop: false,
  slideLaserColor: 'red' as SlideLaserColor,
  slidePenColor: 'red' as SlidePenColor,

  slideTabs: { home: true, insert: true, draw: true, design: true, transitions: true, animations: true, slideshow: true, record: true, review: true, view: true } as Record<SlideRibbonTabId, boolean>,
  slideQatShow: true,
  slideQatPosition: 'above' as SlideQatPosition,
  slideQatCommands: ['save', 'undo', 'redo'] as SlideQatCommand[],
};
