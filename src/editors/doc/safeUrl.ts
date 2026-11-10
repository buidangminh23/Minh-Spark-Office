const withoutControls = (value: string) => Array.from(value).filter((char) => {
  const code = char.charCodeAt(0);
  return code > 0x20 && (code < 0x7f || code > 0x9f);
}).join('');

const schemeOf = (value: string) => /^([a-z][a-z0-9+.-]*):/i.exec(withoutControls(value))?.[1]?.toLowerCase() ?? null;

export const safeHttpUrl = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const scheme = schemeOf(text);
  if (scheme !== 'http' && scheme !== 'https') return '';
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? text : '';
  } catch {
    return '';
  }
};

export const safeImageSrc = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const scheme = schemeOf(text);
  if (scheme === null) return /^[a-z0-9._~/?#%-]/i.test(text) && !text.startsWith('//') ? text : null;
  if (scheme === 'http' || scheme === 'https') return safeHttpUrl(text) || null;
  if (scheme === 'blob') return text;
  if (scheme === 'data') return /^data:image\/[a-z0-9.+-]+[;,]/i.test(withoutControls(text)) ? text : null;
  return null;
};

export const safeFileData = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  const scheme = schemeOf(text);
  return scheme === 'data' || scheme === 'blob' ? text : '';
};
