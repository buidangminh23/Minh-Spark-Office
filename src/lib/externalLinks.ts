import { getSettings } from './appSettings';

export function openExternalLink(href: string) {
  if (!href) return false;
  if (getSettings().confirmLinks && !window.confirm(`Mở liên kết này trong trình duyệt?\n\n${href}`)) return false;
  window.open(href, '_blank', 'noopener');
  return true;
}
