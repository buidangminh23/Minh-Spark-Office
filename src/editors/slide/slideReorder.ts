export function insertionIndex(midpoints: number[], position: number): number {
  let index = 0;
  while (index < midpoints.length && midpoints[index] < position) index += 1;
  return index;
}

export function finalSlideIndex(from: number, insertBefore: number): number {
  return insertBefore > from ? insertBefore - 1 : insertBefore;
}

export function edgeScrollStep(position: number, start: number, end: number, edge: number, maxStep: number): number {
  if (position < start + edge) return -Math.ceil(maxStep * Math.min(1, (start + edge - position) / edge));
  if (position > end - edge) return Math.ceil(maxStep * Math.min(1, (position - (end - edge)) / edge));
  return 0;
}
