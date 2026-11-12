export type SlideLayout =
  | 'title'
  | 'title-content'
  | 'section'
  | 'two-content'
  | 'comparison'
  | 'title-only'
  | 'blank'
  | 'content-caption'
  | 'picture-caption';

export type ShapeType = string;

export type ChartType = 'bar' | 'column' | 'line' | 'pie' | 'doughnut';

export type TransitionCategory = 'subtle' | 'exciting' | 'dynamic';

export type TransitionType =
  | 'none'
  | 'morph'
  | 'fade'
  | 'push'
  | 'wipe'
  | 'split'
  | 'reveal'
  | 'cut'
  | 'random-bars'
  | 'shape'
  | 'uncover'
  | 'cover'
  | 'flash'
  | 'fall-over'
  | 'drape'
  | 'curtains'
  | 'wind'
  | 'prestige'
  | 'fracture'
  | 'crush'
  | 'peel-off'
  | 'page-curl'
  | 'airplane'
  | 'origami'
  | 'dissolve'
  | 'checkerboard'
  | 'blinds'
  | 'clock'
  | 'ripple'
  | 'honeycomb'
  | 'glitter'
  | 'vortex'
  | 'shred'
  | 'switch'
  | 'flip'
  | 'gallery'
  | 'cube'
  | 'doors'
  | 'box'
  | 'comb'
  | 'zoom'
  | 'random'
  | 'pan'
  | 'ferris'
  | 'conveyor'
  | 'rotate'
  | 'window'
  | 'orbit'
  | 'fly-through'
  | 'carousel';

export type TransitionDirection =
  | 'from-bottom'
  | 'from-left'
  | 'from-right'
  | 'from-top'
  | 'horizontal'
  | 'vertical'
  | 'in'
  | 'out';

export type TransitionSound =
  | 'none'
  | 'applause'
  | 'camera'
  | 'chime'
  | 'click'
  | 'coin'
  | 'drum'
  | 'laser'
  | 'whoosh'
  | 'wind'
  | 'bomb'
  | 'typewriter'
  | 'voltage';

export type AnimationCategory = 'entrance' | 'emphasis' | 'exit' | 'motion-path';

export type AnimationType = string;

export type AnimationTrigger = 'on-click' | 'with-previous' | 'after-previous';

export type AnimationDirection =
  | 'bottom'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right'
  | 'horizontal'
  | 'vertical'
  | 'in'
  | 'out';

export interface ElementAnimation {
  id: string;
  type: AnimationType;
  category: AnimationCategory;
  duration: number;
  delay: number;
  trigger: AnimationTrigger;
  direction?: AnimationDirection;
  order: number;
  sound?: TransitionSound;
  repeat?: number | 'until-next-click' | 'until-end-of-slide';
  autoReverse?: boolean;
  smoothStart?: boolean;
  smoothEnd?: boolean;
  bounceEnd?: boolean;
  animateText?: 'all' | 'word' | 'letter' | 'paragraph';
  triggerElementId?: string;
  afterAnimation?: 'dont-dim' | 'dim' | 'hide' | 'hide-on-next-click';
  dimColor?: string;
  motionPathCoords?: { dx: number; dy: number };
}

export type ElementType =
  | 'text'
  | 'shape'
  | 'image'
  | 'table'
  | 'chart'
  | 'smartart'
  | 'qr'
  | 'ink'
  | 'code'
  | 'math'
  | 'zoom'
  | '3d'
  | 'video'
  | 'countdown'
  | 'poll'
  | 'icon'
  | 'audio'
  | 'cameo'
  | 'object';

export type SlideLinkKind = 'url' | 'slide' | 'next' | 'prev' | 'first' | 'last' | 'end' | 'email';

export interface SlideLink {
  kind: SlideLinkKind;
  url?: string;
  slideId?: string;
  tooltip?: string;
  trigger?: 'click' | 'hover';
  sound?: TransitionSound;
}

export type TextDirection = 'horizontal' | 'rotate-90' | 'rotate-270' | 'stacked';

export type TextFieldType = 'date' | 'slide-number';

export interface ImageAdjustments {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  sharpness?: number;
  grayscale?: number;
  sepia?: number;
  invert?: number;
  blur?: number;
  hue?: number;
  artistic?: string;
  recolor?: string;
}

export interface ImageCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SlideComment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  elementId?: string;
  resolved?: boolean;
  replies?: { id: string; author: string; text: string; createdAt: number }[];
  read?: boolean;
}

export interface ChartSeries {
  name: string;
  values: number[];
  color: string;
}

export interface SmartArtItem {
  title: string;
  desc: string;
  icon?: string;
  color?: string;
}

export interface SlideElement {
  id: string;
  type: ElementType;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
  rotation?: number; // degrees 0-360
  opacity?: number;
  zIndex?: number;
  groupId?: string;
  flipH?: boolean;
  flipV?: boolean;
  name?: string;
  hidden?: boolean;
  link?: SlideLink;
  altText?: string;
  decorative?: boolean;

  // Text properties
  text?: string;
  fontFamily?: string;
  fontSize?: number; // pt (10 - 96)
  fontWeight?: 'normal' | 'bold' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textShadow?: boolean;
  lineHeight?: number;
  isBullet?: boolean;
  bulletStyle?: 'disc' | 'circle' | 'square' | 'check' | 'arrow' | 'number';
  isTitle?: boolean;
  placeholder?: string;
  strikethrough?: boolean;
  highlight?: string;
  indentLevel?: number;
  textDirection?: TextDirection;
  textColumns?: number;
  field?: TextFieldType;
  fieldFormat?: string;
  wordArt?: string;
  textOutline?: string;
  textGradient?: string;
  textGlow?: string;

  // Shape properties
  shapeType?: ShapeType;
  customPath?: string;
  fill?: string;
  fillType?: 'solid' | 'gradient' | 'none';
  gradient?: string;
  stroke?: string;
  strokeWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number;
  shapeShadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  glow?: boolean;
  glowColor?: string;
  padding?: number;
  letterSpacing?: number;

  // Image properties
  src?: string;
  alt?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  imageAdjust?: ImageAdjustments;
  crop?: ImageCrop;
  originalSrc?: string;

  // Table properties
  tableRows?: number;
  tableCols?: number;
  tableData?: string[][];
  tableHeaderRow?: boolean;
  tableHeaderColor?: string;
  tableHeaderTextColor?: string;

  // Chart properties
  chartType?: ChartType;
  chartTitle?: string;
  chartCategories?: string[];
  chartSeries?: ChartSeries[];

  // SmartArt properties
  smartArtType?: 'process' | 'cycle' | 'pyramid' | 'list' | 'matrix';
  smartArtItems?: SmartArtItem[];

  // QR properties
  qrText?: string;
  qrColor?: string;

  // Ink properties
  inkPoints?: number[];
  inkColor?: string;
  inkWidth?: number;

  // Code properties
  codeLang?: string;
  codeContent?: string;

  // Math properties
  mathFormula?: string;

  // Zoom slide properties
  zoomSlideId?: string;
  zoomSlideTitle?: string;

  // Lock status
  locked?: boolean;

  // Visual polish
  imageMask?: 'none' | 'circle' | 'rounded' | 'hexagon' | 'star' | 'diamond';
  reflection?: boolean;

  // 3D Model properties
  model3d?: {
    type: 'cube' | 'cylinder' | 'sphere' | 'torus' | 'pyramid' | 'device';
    rotX: number;
    rotY: number;
    rotZ: number;
    zoom: number;
    color?: string;
    wireframe?: boolean;
  };

  // Video properties
  videoData?: {
    url: string;
    trimStart?: number;
    trimEnd?: number;
    autoplay?: boolean;
    loop?: boolean;
    poster?: string;
    shape?: 'rect' | 'rounded' | 'oval';
  };

  // Countdown timer properties
  countdownData?: {
    duration: number; // in seconds
    remaining: number;
    running: boolean;
    title?: string;
    theme?: 'dark' | 'neon' | 'clean';
  };

  // Live audience poll properties
  pollData?: {
    question: string;
    options: { id: string; text: string; votes: number }[];
    type?: 'multiple' | 'wordcloud';
    active?: boolean;
    qrCode?: boolean;
  };

  // Live Linked Data from Minh Sheets
  sheetLink?: {
    fileId?: string;
    sheetName: string;
    range: string;
    lastSync?: string;
    autoUpdate?: boolean;
  };

  // Icon properties
  iconName?: string;

  // Audio properties
  audioData?: {
    url: string;
    name?: string;
    autoplay?: boolean;
    loop?: boolean;
    hideDuringShow?: boolean;
    playAcrossSlides?: boolean;
    volume?: number;
  };

  // Embedded object properties
  objectData?: {
    name: string;
    mime: string;
    url: string;
    size: number;
    displayAsIcon?: boolean;
  };

  // Cameo (live camera) properties
  cameoData?: {
    shape?: 'circle' | 'rounded' | 'rect';
    mirror?: boolean;
    deviceId?: string;
  };

  // Animation properties
  animation?: {
    type: AnimationType;
    duration: number;
    delay: number;
    direction?: AnimationDirection;
    trigger?: AnimationTrigger;
  };
  animations?: ElementAnimation[];
}

export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image';
  value: string;
}

export interface SlideTransition {
  type: TransitionType;
  duration: number; // in seconds, e.g. 0.5
  direction?: TransitionDirection;
  sound?: TransitionSound;
  advanceOnClick?: boolean;
  advanceAfterSeconds?: number;
  loopSound?: boolean;
  morphMode?: 'objects' | 'words' | 'characters';
}

export interface SlideSection {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface SlideData {
  id: string;
  layout: SlideLayout;
  background: SlideBackground;
  elements: SlideElement[];
  notes: string;
  transition: SlideTransition;
  hidden?: boolean;
  sectionId?: string;
  comments?: SlideComment[];
  rehearsedSeconds?: number;
  hideBackgroundGraphics?: boolean;
}

export interface SlideTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBackground: string;
  titleColor: string;
  textColor: string;
  titleFont: string;
  bodyFont: string;
}

export interface PresentationData {
  slides: SlideData[];
  aspectRatio: SlideAspect;
  themeId: string;
  themeOverrides?: ThemeOverrides;
  showSettings?: ShowSettings;
  language?: string;
  headerFooter?: HeaderFooterSettings;
  handoutMaster?: HandoutMasterSettings;
  notesMaster?: NotesMasterSettings;
  macros?: SlideMacro[];
  title?: string;
  author?: string;
  sections?: SlideSection[];
  watermark?: {
    text: string;
    enabled: boolean;
    opacity?: number;
  };
  customShows?: {
    id: string;
    name: string;
    slideIds: string[];
  }[];
  slideMaster?: {
    enabled: boolean;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
    showSlideNumber?: boolean;
  };
}

export type SlideAspect = '16:9' | '4:3' | '16:10' | 'A4' | '1:1';

export interface ThemeOverrides {
  variant?: number;
  colors?: Partial<Pick<SlideTheme, 'primaryColor' | 'secondaryColor' | 'accentColor' | 'backgroundColor' | 'cardBackground' | 'titleColor' | 'textColor'>>;
  colorSchemeId?: string;
  fonts?: { titleFont: string; bodyFont: string; id?: string };
  effects?: 'none' | 'subtle' | 'moderate' | 'intense';
}

export interface ShowSettings {
  showType?: 'speaker' | 'window' | 'kiosk';
  loop?: boolean;
  withoutNarration?: boolean;
  withoutAnimation?: boolean;
  disableHardwareAcceleration?: boolean;
  penColor?: string;
  laserColor?: string;
  rangeFrom?: number;
  rangeTo?: number;
  customShowId?: string;
  advance?: 'manual' | 'timings';
  useTimings?: boolean;
  playNarrations?: boolean;
  showMediaControls?: boolean;
  usePresenterView?: boolean;
  monitor?: string;
  alwaysSubtitles?: boolean;
  subtitleLanguage?: string;
  subtitlePosition?: 'bottom' | 'top' | 'overlay-bottom' | 'overlay-top';
  keepSlidesUpdated?: boolean;
}

export interface HeaderFooterSettings {
  showDate?: boolean;
  dateMode?: 'auto' | 'fixed';
  dateFormat?: string;
  fixedDate?: string;
  showSlideNumber?: boolean;
  showFooter?: boolean;
  footerText?: string;
  hideOnTitle?: boolean;
  notesHeader?: string;
  notesFooter?: string;
}

export interface HandoutMasterSettings {
  slidesPerPage?: 1 | 2 | 3 | 4 | 6 | 9;
  orientation?: 'portrait' | 'landscape';
  header?: string;
  footer?: string;
  showDate?: boolean;
  showPageNumber?: boolean;
}

export interface NotesMasterSettings {
  orientation?: 'portrait' | 'landscape';
  header?: string;
  footer?: string;
  showSlideImage?: boolean;
  showPageNumber?: boolean;
  bodyFontSize?: number;
}

export interface SlideMacro {
  id: string;
  name: string;
  description?: string;
  steps: MacroStep[];
}

export type MacroStep =
  | { op: 'theme'; themeId: string }
  | { op: 'font'; fontFamily: string }
  | { op: 'font-size'; delta: number }
  | { op: 'color'; color: string }
  | { op: 'replace'; find: string; replace: string }
  | { op: 'transition'; transition: TransitionType }
  | { op: 'background'; value: string }
  | { op: 'slide-numbers'; enabled: boolean }
  | { op: 'align'; textAlign: 'left' | 'center' | 'right' | 'justify' };
