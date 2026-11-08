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

export type ShapeType =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'circle'
  | 'triangle'
  | 'right-arrow'
  | 'left-arrow'
  | 'up-arrow'
  | 'down-arrow'
  | 'star'
  | 'callout'
  | 'heart'
  | 'diamond'
  | 'hexagon'
  | 'line';

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
  | 'uncover'
  | 'cover'
  | 'flip'
  | 'cube'
  | 'doors'
  | 'box'
  | 'zoom'
  | 'conveyor'
  | 'rotate'
  | 'vortex'
  | 'ripple'
  | 'honeycomb'
  | 'fracture'
  | 'pan'
  | 'ferris'
  | 'carousel'
  | 'gallery';

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

export type AnimationType =
  | 'none'
  // Entrance (Xuất hiện - 🟢)
  | 'appear'
  | 'fade-in'
  | 'fly-in'
  | 'float-in'
  | 'split-in'
  | 'wipe-in'
  | 'zoom-in'
  | 'bounce-in'
  | 'swivel-in'
  | 'wheel-in'
  | 'grow-turn'
  // Emphasis (Nhấn mạnh - 🟡)
  | 'pulse'
  | 'spin'
  | 'teeter'
  | 'grow-shrink'
  | 'color-pulse'
  | 'wave'
  | 'darken'
  | 'lighten'
  // Exit (Thoát - 🔴)
  | 'disappear'
  | 'fade-out'
  | 'fly-out'
  | 'float-out'
  | 'split-out'
  | 'wipe-out'
  | 'zoom-out'
  | 'bounce-out'
  | 'swivel-out'
  // Motion Paths (Đường chuyển động - 🟣)
  | 'path-line-down'
  | 'path-line-up'
  | 'path-line-left'
  | 'path-line-right'
  | 'path-arc'
  | 'path-turn'
  | 'path-circle'
  | 'path-loop'
  | 'path-custom';

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

export type ElementType = 'text' | 'shape' | 'image' | 'table' | 'chart' | 'smartart' | 'qr' | 'ink' | 'code' | 'math' | 'zoom';

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

  // Shape properties
  shapeType?: ShapeType;
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
  aspectRatio: '16:9' | '4:3';
  themeId: string;
  title?: string;
  author?: string;
  sections?: SlideSection[];
  watermark?: {
    text: string;
    enabled: boolean;
    opacity?: number;
  };
}
