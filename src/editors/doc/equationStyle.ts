export type EquationAlign = 'left' | 'center' | 'right';

export interface EquationPresentation {
  display: boolean;
  numbered: boolean;
  align: EquationAlign;
  size: number;
  color: string;
  boxed: boolean;
}

export const EQUATION_SIZES = [80, 100, 125, 150, 200] as const;
export const EQUATION_COLORS = ['', '#c00000', '#1f4e9c', '#107c41', '#7030a0', '#c55a11'] as const;

const ALIGNS: EquationAlign[] = ['left', 'center', 'right'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const EQUATION_DEFAULTS: EquationPresentation = { display: false, numbered: false, align: 'center', size: 100, color: '', boxed: false };

export const normalizePresentation = (attrs: Record<string, unknown> | null | undefined): EquationPresentation => {
  const size = Number(attrs?.size);
  const color = String(attrs?.color ?? '');
  const display = Boolean(attrs?.display);
  return {
    display,
    numbered: display && Boolean(attrs?.numbered),
    align: ALIGNS.includes(attrs?.align as EquationAlign) ? (attrs?.align as EquationAlign) : 'center',
    size: Number.isFinite(size) && size >= 50 && size <= 300 ? Math.round(size) : 100,
    color: HEX_COLOR.test(color) ? color.toLowerCase() : '',
    boxed: Boolean(attrs?.boxed),
  };
};

export const equationClassName = (presentation: EquationPresentation): string =>
  [
    'doc-equation',
    presentation.display && 'display',
    presentation.numbered && 'numbered',
    presentation.display && presentation.align !== 'center' && `align-${presentation.align}`,
    presentation.boxed && 'boxed',
  ]
    .filter(Boolean)
    .join(' ');

export const equationInlineStyle = (presentation: EquationPresentation): string =>
  [presentation.size !== 100 && `font-size:${presentation.size}%`, presentation.color && `color:${presentation.color}`].filter(Boolean).join(';');

export const EQUATION_CSS =
  '.doc-equation.boxed .katex{border:1px solid currentColor;border-radius:2px;padding:2px 6px}' +
  '.doc-equation.display.align-left{text-align:left}.doc-equation.display.align-right{text-align:right}' +
  '.doc-equation.display.numbered{position:relative;counter-increment:doc-equation;padding-inline:3.5em}' +
  '.doc-equation.display.numbered::after{content:"(" counter(doc-equation) ")";position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:1rem;color:inherit}';
