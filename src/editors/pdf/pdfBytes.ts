const PDF_DATA_URL_PREFIX = 'data:application/pdf;base64,';

type NativeBase64 = { fromBase64?: (text: string) => Uint8Array };

export function pdfDataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const native = Uint8Array as unknown as NativeBase64;
  if (typeof native.fromBase64 === 'function') {
    try {
      return native.fromBase64(base64);
    } catch {
      return decodeWithAtob(base64);
    }
  }
  return decodeWithAtob(base64);
}

function decodeWithAtob(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

export function pdfBytesToDataUrl(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(PDF_DATA_URL_PREFIX + result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  });
}
