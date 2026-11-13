import { MAX_DIRECT_PDF_BASE64, validateRequest, type AddinProvider, type AddinRequest } from '../../api/_shared/addin';
import { initializeAuthentication, authConfigured } from '../lib/auth';
import { isDesktop } from '../lib/desktop';

const KEY_STORAGE: Record<AddinProvider, string> = { claude: 'minh-docs-anthropic-key', chatgpt: 'minh-office-openai-key' };
const KEY_PATTERN: Record<AddinProvider, RegExp> = { claude: /^sk-ant-[A-Za-z0-9_-]{20,}$/, chatgpt: /^sk-[A-Za-z0-9_-]{20,}$/ };
const API_URL = isDesktop() ? 'https://office.minhspark.com/api/ai' : '/api/ai';
const ERROR_MARK = '\u0000ERROR:';

export type AddinMode = 'own-key' | 'account' | 'none';

export class AddinError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export function getProviderKey(provider: AddinProvider) {
  try {
    return localStorage.getItem(KEY_STORAGE[provider]) ?? '';
  } catch {
    return '';
  }
}

export function setProviderKey(provider: AddinProvider, value: string) {
  const key = value.trim();
  if (key && !KEY_PATTERN[provider].test(key)) throw new AddinError(provider === 'claude' ? 'API key Claude bắt đầu bằng sk-ant-.' : 'API key OpenAI bắt đầu bằng sk-.', 'bad-key');
  try {
    if (key) localStorage.setItem(KEY_STORAGE[provider], key);
    else localStorage.removeItem(KEY_STORAGE[provider]);
  } catch {
    throw new AddinError('Trình duyệt đang chặn lưu dữ liệu trang web, chưa lưu được API key.', 'storage');
  }
}

export function resolveMode(provider: AddinProvider, signedIn: boolean): AddinMode {
  if (getProviderKey(provider)) return 'own-key';
  return signedIn ? 'account' : 'none';
}

async function idToken() {
  if (!authConfigured) return null;
  const auth = await initializeAuthentication();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

async function streamFromServer(request: AddinRequest, onText: (chunk: string) => void, signal: AbortSignal) {
  const token = await idToken();
  if (!token) throw new AddinError('Hãy đăng nhập Google, hoặc nhập API key riêng trong Cài đặt add-in.', 'auth');
  let response: Response;
  try {
    response = await fetch(API_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
  } catch (error) {
    if (signal.aborted) throw new AddinError('Đã dừng.', 'aborted');
    throw new AddinError('Không kết nối được tới máy chủ Office 23. Kiểm tra mạng rồi thử lại.', error instanceof Error ? 'network' : 'unknown');
  }
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    throw new AddinError(payload?.error ?? `Máy chủ báo lỗi ${response.status}.`, payload?.code ?? 'server');
  }
  const remaining = Number(response.headers.get('X-Addin-Remaining'));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let tail = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    tail += decoder.decode(value, { stream: true });
    const mark = tail.indexOf(ERROR_MARK);
    if (mark >= 0) {
      if (mark > 0) onText(tail.slice(0, mark));
      throw new AddinError(tail.slice(mark + ERROR_MARK.length), 'provider');
    }
    const pending = tail.lastIndexOf('\u0000');
    const safe = pending >= 0 ? pending : tail.length;
    if (safe > 0) onText(tail.slice(0, safe));
    tail = tail.slice(safe);
  }
  tail += decoder.decode();
  if (tail) onText(tail);
  return Number.isFinite(remaining) ? remaining : null;
}

async function streamDirect(request: AddinRequest, apiKey: string, onText: (chunk: string) => void, signal: AbortSignal) {
  const checked = validateRequest(request, MAX_DIRECT_PDF_BASE64);
  if (!checked.ok) throw new AddinError(checked.error, 'bad-request');
  const { runProvider } = await import('../../api/_shared/run');
  try {
    await runProvider(checked.request, apiKey, onText, signal, true);
  } catch (error) {
    throw new AddinError(error instanceof Error ? error.message : 'Không trả lời được.', 'provider');
  }
  return null;
}

export async function streamAddin(request: AddinRequest, onText: (chunk: string) => void, signal: AbortSignal) {
  const apiKey = getProviderKey(request.provider);
  return apiKey ? streamDirect(request, apiKey, onText, signal) : streamFromServer(request, onText, signal);
}
