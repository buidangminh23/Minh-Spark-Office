export type ImageView = {
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  width: number;
  height: number;
};

export function screenOffsetToImagePoint(offsetX: number, offsetY: number, view: ImageView) {
  const radians = (view.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = (offsetX * cos + offsetY * sin) / view.scale;
  const y = (-offsetX * sin + offsetY * cos) / view.scale;
  return {
    x: (view.flipX ? -x : x) + view.width / 2,
    y: (view.flipY ? -y : y) + view.height / 2,
  };
}

export function isMarkupBlank(pixels: ArrayLike<number>) {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return false;
  return true;
}

export function flattenEncoding(mimeType: string | undefined): { mime: string; quality?: number } {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return { mime: 'image/jpeg', quality: 0.95 };
  if (mimeType === 'image/webp') return { mime: 'image/webp', quality: 0.95 };
  return { mime: 'image/png' };
}
