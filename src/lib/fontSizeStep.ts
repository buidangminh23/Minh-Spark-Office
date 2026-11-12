export function nextFontSize(sizes: readonly number[], current: number, direction: 1 | -1, min = 1): number {
  if (direction > 0) return sizes.find((size) => size > current) ?? current + 10;
  const smaller = [...sizes].reverse().find((size) => size < current);
  return Math.max(min, smaller ?? current - 1);
}
