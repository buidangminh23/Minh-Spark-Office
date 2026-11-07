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

export type TransitionType = 'none' | 'fade' | 'push' | 'wipe' | 'split' | 'zoom' | 'flip';

export type AnimationType = 'none' | 'appear' | 'fade-in' | 'fly-in-up' | 'fly-in-left' | 'zoom-in' | 'bounce';

export type ElementType = 'text' | 'shape' | 'image' | 'table' | 'chart' | 'smartart' | 'qr' | 'ink';

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
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  shapeShadow?: boolean;

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

  // Animation properties
  animation?: {
    type: AnimationType;
    duration: number;
    delay: number;
  };
}

export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image';
  value: string;
}

export interface SlideTransition {
  type: TransitionType;
  duration: number; // in seconds, e.g. 0.5
}

export interface SlideData {
  id: string;
  layout: SlideLayout;
  background: SlideBackground;
  elements: SlideElement[];
  notes: string;
  transition: SlideTransition;
  hidden?: boolean;
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
}
