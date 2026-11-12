import { isDesktop } from './desktop';
import { readAsDataUrl } from './download';
import type { WordPhysicalPages } from './wordPageMap';

const pending = new WeakMap<File, Promise<WordPhysicalPages>>();

export function canMeasureWordPages() {
  return isDesktop() && /Windows/i.test(navigator.userAgent);
}

async function measure(file: File) {
  if (file.size > 50 * 1024 * 1024) throw new Error('Microsoft Word chỉ có thể phân trang tệp tối đa 50 MB trong ứng dụng.');
  const { invoke } = await import('@tauri-apps/api/core');
  const url = await readAsDataUrl(file);
  try {
    return await invoke<WordPhysicalPages>('word_physical_pages', { data: url.slice(url.indexOf(',') + 1) });
  } catch (error) {
    throw new Error(typeof error === 'string' ? error : 'Không đọc được số trang bằng Microsoft Word.');
  }
}

export function measureWordPages(file: File) {
  const cached = pending.get(file);
  if (cached) return cached;
  const result = measure(file).catch(error => {
    pending.delete(file);
    throw error;
  });
  pending.set(file, result);
  return result;
}
