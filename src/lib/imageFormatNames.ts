export const SUPPORTED_IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'jpe',
  'webp',
  'gif',
  'svg',
  'svgz',
  'bmp',
  'dib',
  'ico',
  'avif',
  'tiff',
  'tif',
  'heic',
  'heif',
] as const;

export const IMAGE_EXTENSIONS_PATTERN =
  /\.(png|jpe?g|jfif|jpe|webp|gif|svg|svgz|bmp|dib|ico|avif|tiff?|heic|heif)$/i;

export const IMAGE_ACCEPT_STRING =
  '.png,.jpg,.jpeg,.jfif,.jpe,.webp,.gif,.svg,.svgz,.bmp,.dib,.ico,.avif,.tiff,.tif,.heic,.heif';

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS_PATTERN.test(fileName);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
