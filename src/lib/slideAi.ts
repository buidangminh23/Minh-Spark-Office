import { streamAddin } from '../addins/client';
import type { AddinProvider } from '../../api/_shared/addin';

const PROVIDER_KEY = 'minh-slides-ai-provider';

export function slideAiProvider(): AddinProvider {
  try {
    return localStorage.getItem(PROVIDER_KEY) === 'chatgpt' ? 'chatgpt' : 'claude';
  } catch {
    return 'claude';
  }
}

export async function askSlideAi(instruction: string, context: string, signal: AbortSignal): Promise<string> {
  let text = '';
  await streamAddin(
    {
      provider: slideAiProvider(),
      app: 'doc',
      documentName: '23 Slides',
      turns: [{ role: 'user', content: instruction }],
      context: { label: 'Nội dung trang chiếu', text: context },
    },
    (chunk) => {
      text += chunk;
    },
    signal,
  );
  return text.trim();
}

export function parseJsonBlock<T>(text: string): T | null {
  const match = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = (match ? match[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(body.slice(start)) as T;
  } catch {
    return null;
  }
}

export const TRANSLATE_LANGUAGES: ReadonlyArray<readonly [string, string]> = [
  ['English', 'Tiếng Anh'],
  ['Vietnamese', 'Tiếng Việt'],
  ['Japanese', 'Tiếng Nhật'],
  ['Korean', 'Tiếng Hàn'],
  ['Simplified Chinese', 'Tiếng Trung (giản thể)'],
  ['French', 'Tiếng Pháp'],
  ['German', 'Tiếng Đức'],
  ['Spanish', 'Tiếng Tây Ban Nha'],
  ['Thai', 'Tiếng Thái'],
];
