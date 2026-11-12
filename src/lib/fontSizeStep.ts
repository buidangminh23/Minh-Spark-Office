export const SHEET_FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36, 48, 72];

export function nextFontSize(sizes: readonly number[], current: number, direction: 1 | -1, min = 1): number {
  if (direction > 0) return sizes.find((size) => size > current) ?? current + 10;
  const smaller = [...sizes].reverse().find((size) => size < current);
  return Math.max(min, smaller ?? current - 1);
}
