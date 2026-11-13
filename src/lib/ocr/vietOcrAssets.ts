export type OcrAssetName = 'runtime' | 'detector' | 'encoder' | 'decoder';
export type OcrAsset = { name: OcrAssetName; path: string; bytes: number; sha256: string };
export type OcrAssetProgress = (loadedBytes: number, totalBytes: number) => void;

export const VIETOCR_ASSETS: readonly OcrAsset[] = [
  { name: 'runtime', path: 'ocr/vietocr/ort-wasm-simd-threaded.wasm', bytes: 14_848_852, sha256: '4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d' },
  { name: 'detector', path: 'ocr/vietocr/ppocrv6-det-small.onnx', bytes: 9_929_594, sha256: '090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f' },
  { name: 'encoder', path: 'ocr/vietocr/vietocr-encoder.onnx', bytes: 56_715_608, sha256: 'e5329b0e591ede569b8908b6525dfab3bce04b5bcf5ce3aa3a17815a9a81c038' },
  { name: 'decoder', path: 'ocr/vietocr/vietocr-decoder.onnx', bytes: 19_840_821, sha256: 'b6847d202a730661ac9bf7d80b4c52350da2774e2a4859f6877c3e1d3b416ac1' },
];

export const VIETOCR_TOTAL_BYTES = VIETOCR_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0);
export const DESKTOP_ASSET_ORIGIN = 'https://office.minhspark.com/';
const CACHE_PREFIX = 'office-ocr-asset:';

export type AssetCache = {
  get(key: string): Promise<ArrayBuffer | undefined>;
  set(key: string, value: ArrayBuffer): Promise<void>;
  delete(key: string): Promise<void>;
};

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function download(url: string, asset: OcrAsset, onBytes: (bytes: number) => void, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok || !response.body) throw new Error(`Không tải được mô hình OCR (${response.status}).`);
  const reader = response.body.getReader();
  const target = new Uint8Array(asset.bytes);
  let offset = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.length > target.length) throw new Error('Mô hình OCR tải về lớn hơn dự kiến.');
    target.set(value, offset);
    offset += value.length;
    onBytes(value.length);
  }
  if (offset !== asset.bytes) throw new Error('Mô hình OCR tải về chưa đầy đủ.');
  return target.buffer;
}

export async function loadOcrAssets(base: string, cache: AssetCache, onProgress?: OcrAssetProgress, signal?: AbortSignal): Promise<Record<OcrAssetName, ArrayBuffer>> {
  const result = {} as Record<OcrAssetName, ArrayBuffer>;
  let loaded = 0;
  const report = (bytes: number) => { loaded += bytes; onProgress?.(loaded, VIETOCR_TOTAL_BYTES); };
  for (const asset of VIETOCR_ASSETS) {
    const key = `${CACHE_PREFIX}${asset.sha256}`;
    const cached = await cache.get(key).catch(() => undefined);
    if (cached && cached.byteLength === asset.bytes && await sha256Hex(cached) === asset.sha256) {
      result[asset.name] = cached;
      report(asset.bytes);
      continue;
    }
    if (cached) await cache.delete(key).catch(() => {});
    const buffer = await download(new URL(asset.path, base).href, asset, report, signal);
    if (await sha256Hex(buffer) !== asset.sha256) throw new Error('Mô hình OCR tải về không khớp mã kiểm tra. Hãy thử lại.');
    await cache.set(key, buffer).catch(() => {});
    result[asset.name] = buffer;
  }
  return result;
}
