export const AUTO_TITLE_MIN_CHARS = 3;
export const AUTO_TITLE_MAX_CHARS = 80;
export const AUTO_TITLE_SCAN_BLOCKS = 20;
export const DOC_EXTENSION = '.docx';

const DEFAULT_DOC_NAME = /^Tài liệu mới(?: \(\d+\))?\.docx$/iu;
const FORBIDDEN_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;
const LEADING_MARKERS = /^[#>\-–•·+\s]+/u;

export interface TitleBlock {
  heading: boolean;
  text: string;
}

export const isDefaultDocName = (name: string): boolean => DEFAULT_DOC_NAME.test(name.trim().normalize('NFC'));

export const cleanTitleText = (text: string): string => {
  const flat = text
    .replace(FORBIDDEN_FILE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_MARKERS, '')
    .replace(/[.\s]+$/, '');
  if (flat.length <= AUTO_TITLE_MAX_CHARS) return flat;
  const cut = flat.slice(0, AUTO_TITLE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > AUTO_TITLE_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trim();
};

export const deriveDocTitle = (blocks: readonly TitleBlock[]): string | null => {
  const usable = blocks.slice(0, AUTO_TITLE_SCAN_BLOCKS).map((block) => ({ ...block, text: cleanTitleText(block.text) }));
  const pick = usable.find((block) => block.heading && block.text.length >= AUTO_TITLE_MIN_CHARS)
    ?? usable.find((block) => block.text.length >= AUTO_TITLE_MIN_CHARS);
  return pick ? `${pick.text}${DOC_EXTENSION}` : null;
};
