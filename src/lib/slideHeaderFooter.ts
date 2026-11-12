import type { PresentationData, SlideData } from './slideTypes';
import { DATE_FORMATS, formatDate } from './slideTextOps';

export interface EffectiveMaster {
  enabled: boolean;
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
  showSlideNumber?: boolean;
  dateText?: string;
}

export function masterForSlide(presentation: PresentationData, slide: SlideData, now = new Date()): EffectiveMaster | undefined {
  const master = presentation.slideMaster;
  const hf = presentation.headerFooter;
  if (slide.hideBackgroundGraphics) return undefined;
  if (hf?.hideOnTitle && slide.layout === 'title') return undefined;
  const dateText = hf?.showDate ? (hf.dateMode === 'fixed' ? hf.fixedDate ?? '' : formatDate(now, hf.dateFormat || DATE_FORMATS[0])) : undefined;
  const footerText = hf?.showFooter ? hf.footerText : master?.footerText;
  const showSlideNumber = hf?.showSlideNumber ?? master?.showSlideNumber;
  const enabled = Boolean(master?.enabled || dateText || footerText || showSlideNumber);
  if (!enabled) return undefined;
  return {
    enabled,
    headerText: master?.enabled ? master.headerText : undefined,
    logoUrl: master?.enabled ? master.logoUrl : undefined,
    footerText,
    showSlideNumber,
    dateText,
  };
}
